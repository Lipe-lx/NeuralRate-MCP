import test from "node:test";
import assert from "node:assert/strict";
import { createExecutorConfig, type ExecutorEnvBindings } from "./config.js";

const baseEnv = (overrides: ExecutorEnvBindings = {}): ExecutorEnvBindings => ({
  NEURALRATE_BENCHMARK_CONTRACT: "0xC0C836A220D006398cdE4D5caf529196E63f81A8",
  NEURALRATE_AGENT_SMART_WALLET: "0xc57130F28f3d670cA75AD9a78784966B767E55e3",
  NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS: "0xc57130F28f3d670cA75AD9a78784966B767E55e3",
  ...overrides,
});

test("executor derives the paymaster RPC URL from the Pimlico API key", () => {
  const config = createExecutorConfig(baseEnv({
    NEURALRATE_CHAIN_ID: "5003",
    PIMLICO_API_KEY: "pimlico_test_key",
  }));

  assert.equal(
    config.aaPaymasterUrl,
    "https://api.pimlico.io/v2/5003/rpc?apikey=pimlico_test_key"
  );
  assert.equal(config.aaBundlerUrls[0], config.aaPaymasterUrl);
});

test("executor accepts an explicit paymaster RPC URL and context", () => {
  const config = createExecutorConfig(baseEnv({
    PIMLICO_API_KEY: "pimlico_test_key",
    NEURALRATE_PAYMASTER_RPC_URL: "https://paymaster.example/rpc",
    NEURALRATE_PAYMASTER_CONTEXT_JSON: "{\"policyId\":\"demo\"}",
  }));

  assert.equal(config.aaPaymasterUrl, "https://paymaster.example/rpc");
  assert.deepEqual(config.aaPaymasterContext, { policyId: "demo" });
});

test("executor rejects invalid paymaster context JSON", () => {
  assert.throws(
    () => createExecutorConfig(baseEnv({
      NEURALRATE_PAYMASTER_CONTEXT_JSON: "{not-json",
    })),
    /NEURALRATE_PAYMASTER_CONTEXT_JSON must be valid JSON/
  );
});
