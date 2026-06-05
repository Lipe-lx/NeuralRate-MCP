import assert from "node:assert/strict";
import test from "node:test";
import {
  MCP_SCOPED_STATE_ROUTE,
  resolveScopedCatalogBinding,
  resolveScopedCatalogRoute,
} from "./scopedCatalog";

test("resolveScopedCatalogBinding maps the state catalog to its dedicated durable object binding", () => {
  assert.equal(resolveScopedCatalogBinding("state"), "MCP_STATE_OBJECT");
  assert.equal(resolveScopedCatalogBinding("config"), "MCP_CONFIG_OBJECT");
  assert.equal(resolveScopedCatalogBinding("benchmark"), "MCP_BENCHMARK_OBJECT");
  assert.equal(resolveScopedCatalogBinding("execution"), "MCP_EXECUTION_OBJECT");
});

test("resolveScopedCatalogRoute resolves the state scoped route directly", () => {
  const route = resolveScopedCatalogRoute(new URL("https://worker.example/mcp/scoped/state"));
  assert.deepEqual(route, {
    route: MCP_SCOPED_STATE_ROUTE,
    domain: "state",
  });
});

test("resolveScopedCatalogRoute resolves the generic scoped route using the state domain query", () => {
  const route = resolveScopedCatalogRoute(new URL("https://worker.example/mcp/scoped?domain=state"));
  assert.deepEqual(route, {
    route: MCP_SCOPED_STATE_ROUTE,
    domain: "state",
  });
});
