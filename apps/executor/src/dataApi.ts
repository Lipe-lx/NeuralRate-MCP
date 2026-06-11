import { safeJsonStringify } from "./json.js";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
};

type DataApiFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type WorkerRecordEnvelope = Record<string, unknown>;

export class DataApiClient {
  constructor(
    private baseUrl: string,
    private internalToken: string | null = null,
    private fetcher: DataApiFetcher = fetch,
  ) {}

  private async request<T>(path: string, options: RequestOptions = {}) {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(this.internalToken ? { "X-NeuralRate-Internal-Token": this.internalToken } : {}),
        ...(options.headers ?? {}),
      },
      body: options.body !== undefined ? safeJsonStringify(options.body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Data API ${response.status} ${response.statusText}: ${text}`);
    }

    return (await response.json()) as T;
  }

  private async requestRecord(path: string, recordKey: "job" | "benchmarkJob", options: RequestOptions = {}) {
    const envelope = await this.request<WorkerRecordEnvelope>(path, options);
    const record = envelope[recordKey];
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error(`Data API response missing ${recordKey} record`);
    }

    return record as Record<string, unknown>;
  }

  getAutomationState(ownerEoa: string) {
    return this.request(`/automation/state?ownerEoa=${encodeURIComponent(ownerEoa)}`);
  }

  bootstrapUser(body: Record<string, unknown>) {
    return this.request("/users/bootstrap", { method: "POST", body });
  }

  verifyMutationAuth(body: Record<string, unknown>) {
    return this.request("/auth/verify", { method: "POST", body, headers: {} });
  }

  getAgentConfig(ownerEoa: string) {
    return this.request(`/agent-config?ownerEoa=${encodeURIComponent(ownerEoa)}`);
  }

  updateAgentConfig(body: Record<string, unknown>) {
    return this.request("/agent-config", { method: "PATCH", body });
  }

  getVault(ownerEoa: string) {
    return this.request(`/vault?ownerEoa=${encodeURIComponent(ownerEoa)}`);
  }

  createFundingIntent(body: Record<string, unknown>) {
    return this.request("/vault/funding-intent", { method: "POST", body });
  }

  upsertAccount(body: Record<string, unknown>) {
    return this.request("/automation/accounts", { method: "POST", body });
  }

  upsertPolicy(body: Record<string, unknown>) {
    return this.request("/automation/policies", { method: "POST", body });
  }

  upsertSession(body: Record<string, unknown>) {
    return this.request("/automation/sessions", { method: "POST", body });
  }

  activateSession(sessionId: string, body: Record<string, unknown>) {
    return this.request(`/automation/sessions/${encodeURIComponent(sessionId)}/activate`, {
      method: "POST",
      body,
    });
  }

  revokeSession(sessionId: string, body: Record<string, unknown>) {
    return this.request(`/automation/sessions/${encodeURIComponent(sessionId)}/revoke`, {
      method: "POST",
      body,
    });
  }

  upsertAutomationJob(body: Record<string, unknown>) {
    return this.requestRecord("/automation/jobs", "job", { method: "POST", body });
  }

  updateAutomationJob(jobId: string, body: Record<string, unknown>) {
    return this.requestRecord(`/automation/jobs/${encodeURIComponent(jobId)}`, "job", { method: "PATCH", body });
  }

  upsertBenchmarkJob(body: Record<string, unknown>) {
    return this.requestRecord("/benchmark-jobs", "benchmarkJob", { method: "POST", body });
  }

  updateBenchmarkJob(jobId: string, body: Record<string, unknown>) {
    return this.requestRecord(`/benchmark-jobs/${encodeURIComponent(jobId)}`, "benchmarkJob", { method: "PATCH", body });
  }

  updateDecisionBenchmark(decisionId: string, body: Record<string, unknown>) {
    return this.request(`/decisions/${encodeURIComponent(decisionId)}/benchmark`, { method: "PATCH", body });
  }
}
