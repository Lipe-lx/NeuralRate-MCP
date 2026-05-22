const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const defaultLocalOrigin = 'http://localhost:8787';
const defaultPublicWorkerOrigin = 'https://neuralrate-worker.<ACCOUNT>.workers.dev';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const publicApiBaseUrl = import.meta.env.VITE_PUBLIC_API_BASE_URL?.trim();
const publicMcpHttpUrl = import.meta.env.VITE_PUBLIC_MCP_HTTP_URL?.trim();
const publicMcpSseUrl = import.meta.env.VITE_PUBLIC_MCP_SSE_URL?.trim();

const workerOrigin = isLocal
  ? defaultLocalOrigin
  : trimTrailingSlash(
      publicApiBaseUrl?.replace(/\/api\/?$/, '') ||
      publicMcpHttpUrl?.replace(/\/mcp\/?$/, '') ||
      publicMcpSseUrl?.replace(/\/sse\/?$/, '') ||
      defaultPublicWorkerOrigin
    );

export const API_BASE_URL = isLocal
  ? `${defaultLocalOrigin}/api`
  : trimTrailingSlash(publicApiBaseUrl || `${workerOrigin}/api`);

export const MCP_HTTP_URL = isLocal
  ? `${defaultLocalOrigin}/mcp`
  : trimTrailingSlash(publicMcpHttpUrl || `${workerOrigin}/mcp`);

export const SSE_URL = isLocal
  ? `${defaultLocalOrigin}/sse`
  : trimTrailingSlash(publicMcpSseUrl || `${workerOrigin}/sse`);

export const MCP_PROTOCOL_URL = MCP_HTTP_URL.replace(/^http/, 'mcp+sse');
