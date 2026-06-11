import test from "node:test";
import assert from "node:assert/strict";
import { DataApiClient } from "./dataApi.js";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("automation job mutations unwrap worker response envelopes", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const client = new DataApiClient("https://data.test/api", "secret-token", async (input, init) => {
    calls.push({ input, init });
    return jsonResponse({
      success: true,
      job: {
        job_id: "job_123",
        status: "queued",
      },
    });
  });

  const job = await client.upsertAutomationJob({ jobId: "job_123" });

  assert.deepEqual(job, {
    job_id: "job_123",
    status: "queued",
  });
  assert.equal(calls[0]?.input, "https://data.test/api/automation/jobs");
  assert.equal((calls[0]?.init?.headers as Record<string, string>)["X-NeuralRate-Internal-Token"], "secret-token");
});

test("benchmark job mutations unwrap worker response envelopes", async () => {
  const client = new DataApiClient("https://data.test/api", null, async () =>
    jsonResponse({
      success: true,
      benchmarkJob: {
        benchmark_job_id: "benchmark_abc",
        status: "failed",
        failure_reason: "Cannot read properties of undefined",
      },
    })
  );

  const benchmarkJob = await client.updateBenchmarkJob("benchmark_abc", {
    status: "failed",
  });

  assert.deepEqual(benchmarkJob, {
    benchmark_job_id: "benchmark_abc",
    status: "failed",
    failure_reason: "Cannot read properties of undefined",
  });
});

test("job mutations fail loudly when the worker omits the expected record", async () => {
  const client = new DataApiClient("https://data.test/api", null, async () => jsonResponse({ success: true }));

  await assert.rejects(
    () => client.upsertBenchmarkJob({ benchmarkJobId: "benchmark_missing" }),
    /Data API response missing benchmarkJob record/
  );
});
