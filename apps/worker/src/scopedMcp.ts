export type ScopedCatalogRequest = {
  sessionToken: string | null;
  mcpSessionId: string | null;
};

const trimToNull = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const getScopedCatalogRequest = (request: Request): ScopedCatalogRequest => {
  const url = new URL(request.url);
  return {
    sessionToken:
      trimToNull(request.headers.get("x-neuralrate-session-token")) ??
      trimToNull(url.searchParams.get("sessionToken")),
    mcpSessionId: trimToNull(request.headers.get("mcp-session-id")),
  };
};
