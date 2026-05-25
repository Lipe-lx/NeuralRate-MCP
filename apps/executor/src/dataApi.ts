type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
};

export class DataApiClient {
  constructor(
    private baseUrl: string,
    private internalToken: string | null = null,
  ) {}

  private async request<T>(path: string, options: RequestOptions = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(this.internalToken ? { "X-NeuralRate-Internal-Token": this.internalToken } : {}),
        ...(options.headers ?? {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Data API ${response.status} ${response.statusText}: ${text}`);
    }

    return (await response.json()) as T;
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
    return this.request("/automation/jobs", { method: "POST", body });
  }

  updateAutomationJob(jobId: string, body: Record<string, unknown>) {
    return this.request(`/automation/jobs/${encodeURIComponent(jobId)}`, { method: "PATCH", body });
  }

  upsertBenchmarkJob(body: Record<string, unknown>) {
    return this.request("/benchmark-jobs", { method: "POST", body });
  }

  updateBenchmarkJob(jobId: string, body: Record<string, unknown>) {
    return this.request(`/benchmark-jobs/${encodeURIComponent(jobId)}`, { method: "PATCH", body });
  }

  updateDecisionBenchmark(decisionId: string, body: Record<string, unknown>) {
    return this.request(`/decisions/${encodeURIComponent(decisionId)}/benchmark`, { method: "PATCH", body });
  }
}
