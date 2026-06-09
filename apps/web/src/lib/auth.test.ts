// Set the mock synchronously at the module level
globalThis.window = {
  location: {
    hostname: "localhost",
    host: "localhost:8787"
  }
} as any;

import assert from "node:assert/strict";
import test, { beforeEach, afterEach } from "node:test";

const originalFetch = globalThis.fetch;

test.describe("auth utilities", () => {
  let fetchCalls: Array<{ url: string; options?: RequestInit }> = [];
  let authorizedGetJsonFetch: any;

  beforeEach(async () => {
    fetchCalls = [];
    globalThis.fetch = async (url: string | URL | Request, options?: RequestInit) => {
      const urlStr = url.toString();
      fetchCalls.push({ url: urlStr, options });

      if (urlStr.endsWith("/auth/nonce")) {
        return new Response(JSON.stringify({
          success: true,
          challenge: {
            ownerEoa: "0xowner",
            nonce: "test_nonce",
            issuedAt: "2026-06-09T00:00:00Z",
            expiresAt: "2026-06-09T01:00:00Z",
            statement: "test",
            message: "Sign this message"
          }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true, decisions: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    };

    // Dynamically import to ensure window mock is ready
    if (!authorizedGetJsonFetch) {
      const module = await import("./auth");
      authorizedGetJsonFetch = module.authorizedGetJsonFetch;
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("authorizedGetJsonFetch uses session token if provided without signing message", async () => {
    let signMessageCalled = false;
    const mockSignMessage = async (_msg: string) => {
      signMessageCalled = true;
      return "mock_signature";
    };

    const res = await authorizedGetJsonFetch({
      ownerEoa: "0xowner",
      signMessage: mockSignMessage,
      url: "https://api.test/benchmark/history",
      sessionToken: "session_123"
    });

    assert.deepEqual(res, { success: true, decisions: [] });
    assert.equal(signMessageCalled, false, "Should not request wallet signature when sessionToken is active");
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "https://api.test/benchmark/history");
    assert.equal(fetchCalls[0].options?.headers?.["x-neuralrate-session-token"], "session_123");
  });

  test("authorizedGetJsonFetch falls back to signed GET (requiring wallet signature) if session token is absent", async () => {
    let signMessageCalled = false;
    let signedMessage = "";
    const mockSignMessage = async (msg: string) => {
      signMessageCalled = true;
      signedMessage = msg;
      return "mock_signature";
    };

    const res = await authorizedGetJsonFetch({
      ownerEoa: "0xowner",
      signMessage: mockSignMessage,
      url: "https://api.test/benchmark/history",
      sessionToken: null
    });

    assert.deepEqual(res, { success: true, decisions: [] });
    assert.equal(signMessageCalled, true, "Should prompt for wallet signature when sessionToken is null");
    assert.equal(signedMessage, "Sign this message");
    
    assert.equal(fetchCalls.length, 2);
    assert.equal(fetchCalls[0].url.endsWith("/auth/nonce"), true);
    assert.equal(fetchCalls[1].url, "https://api.test/benchmark/history");
    assert.equal(fetchCalls[1].options?.headers?.["x-neuralrate-auth-signature"], "mock_signature");
    assert.equal(fetchCalls[1].options?.headers?.["x-neuralrate-auth-nonce"], "test_nonce");
  });
});
