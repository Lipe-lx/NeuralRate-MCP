export type ScopedMutationDomain = "config" | "benchmark" | "execution";
export type ScopedCatalogDomain = "state" | ScopedMutationDomain;

export const MCP_SCOPED_ROUTE = "/mcp/scoped";
export const MCP_SCOPED_SSE_ALIAS_ROUTE = "/sse/scoped";
export const MCP_SCOPED_STATE_ROUTE = "/mcp/scoped/state";
export const MCP_SCOPED_STATE_SSE_ALIAS_ROUTE = "/sse/scoped/state";
export const MCP_SCOPED_CONFIG_ROUTE = "/mcp/scoped/config";
export const MCP_SCOPED_CONFIG_SSE_ALIAS_ROUTE = "/sse/scoped/config";
export const MCP_SCOPED_BENCHMARK_ROUTE = "/mcp/scoped/benchmark";
export const MCP_SCOPED_BENCHMARK_SSE_ALIAS_ROUTE = "/sse/scoped/benchmark";
export const MCP_SCOPED_EXECUTION_ROUTE = "/mcp/scoped/execution";
export const MCP_SCOPED_EXECUTION_SSE_ALIAS_ROUTE = "/sse/scoped/execution";

export type ScopedCatalogRoute = {
  route: string;
  domain: ScopedCatalogDomain;
};

export const resolveScopedCatalogRoute = (url: URL): ScopedCatalogRoute | null => {
  if (
    url.pathname.startsWith(MCP_SCOPED_STATE_ROUTE) ||
    url.pathname.startsWith(MCP_SCOPED_STATE_SSE_ALIAS_ROUTE)
  ) {
    return { route: MCP_SCOPED_STATE_ROUTE, domain: "state" };
  }

  if (
    url.pathname.startsWith(MCP_SCOPED_CONFIG_ROUTE) ||
    url.pathname.startsWith(MCP_SCOPED_CONFIG_SSE_ALIAS_ROUTE)
  ) {
    return { route: MCP_SCOPED_CONFIG_ROUTE, domain: "config" };
  }

  if (
    url.pathname.startsWith(MCP_SCOPED_BENCHMARK_ROUTE) ||
    url.pathname.startsWith(MCP_SCOPED_BENCHMARK_SSE_ALIAS_ROUTE)
  ) {
    return { route: MCP_SCOPED_BENCHMARK_ROUTE, domain: "benchmark" };
  }

  if (
    url.pathname.startsWith(MCP_SCOPED_EXECUTION_ROUTE) ||
    url.pathname.startsWith(MCP_SCOPED_EXECUTION_SSE_ALIAS_ROUTE)
  ) {
    return { route: MCP_SCOPED_EXECUTION_ROUTE, domain: "execution" };
  }

  if (url.pathname.startsWith(MCP_SCOPED_ROUTE) || url.pathname.startsWith(MCP_SCOPED_SSE_ALIAS_ROUTE)) {
    const domain = url.searchParams.get("domain")?.trim() ?? null;
    if (domain === "state") {
      return { route: MCP_SCOPED_STATE_ROUTE, domain };
    }
    if (domain === "config") {
      return { route: MCP_SCOPED_CONFIG_ROUTE, domain };
    }
    if (domain === "benchmark") {
      return { route: MCP_SCOPED_BENCHMARK_ROUTE, domain };
    }
    if (domain === "execution") {
      return { route: MCP_SCOPED_EXECUTION_ROUTE, domain };
    }
  }

  return null;
};

export const resolveScopedCatalogBinding = (domain: ScopedCatalogDomain) =>
  domain === "state"
    ? "MCP_STATE_OBJECT"
    : domain === "config"
      ? "MCP_CONFIG_OBJECT"
      : domain === "benchmark"
        ? "MCP_BENCHMARK_OBJECT"
        : "MCP_EXECUTION_OBJECT";
