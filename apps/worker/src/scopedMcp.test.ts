import test from "node:test";
import assert from "node:assert/strict";
import { getScopedCatalogRequest } from "./scopedMcp";

test("scoped MCP request prefers the session token header over the query string", () => {
  const request = new Request("https://worker.example/mcp/scoped/execution?sessionToken=query_token", {
    headers: {
      "x-neuralrate-session-token": "header_token",
    },
  });

  assert.deepEqual(getScopedCatalogRequest(request), {
    sessionToken: "header_token",
    mcpSessionId: null,
  });
});

test("scoped MCP request falls back to the sessionToken query parameter during initialization", () => {
  const request = new Request("https://worker.example/mcp/scoped/execution?sessionToken=query_token");

  assert.deepEqual(getScopedCatalogRequest(request), {
    sessionToken: "query_token",
    mcpSessionId: null,
  });
});

test("scoped MCP request trims blank values and keeps the mcp-session-id for resumed sessions", () => {
  const request = new Request("https://worker.example/mcp/scoped/execution?sessionToken=%20%20query_token%20%20", {
    headers: {
      "mcp-session-id": "  scoped-session-123  ",
      "x-neuralrate-session-token": "   ",
    },
  });

  assert.deepEqual(getScopedCatalogRequest(request), {
    sessionToken: "query_token",
    mcpSessionId: "scoped-session-123",
  });
});
