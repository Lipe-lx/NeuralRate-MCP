const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const API_BASE_URL = isLocal
  ? 'http://localhost:8787/api'
  : 'https://stablesync-worker.stablesync.workers.dev/api';

export const SSE_URL = isLocal
  ? 'http://localhost:8787/sse'
  : 'https://stablesync-worker.stablesync.workers.dev/sse';

export const MCP_PROTOCOL_URL = isLocal
  ? 'mcp+sse://localhost:8787/sse'
  : 'mcp+sse://stablesync-worker.stablesync.workers.dev/sse';
