export type McpAccessDomain = "state" | "config" | "benchmark" | "execution";

export interface McpAccessCatalogDescriptor {
  domain: McpAccessDomain;
  allowed: boolean;
  httpUrl: string;
  sseUrl: string;
  queryHttpUrl: string;
  querySseUrl: string;
}

export interface McpAccessBundle {
  success: true;
  ownerEoa: string;
  userId: string;
  vaultId: string;
  vaultAddress: string;
  agentSubject: string;
  policyVersion: string;
  sessionId: string;
  grantId: string;
  allowedDomains: string[];
  expiresAt: string;
  sessionToken: string;
  headerName: "x-neuralrate-session-token";
  queryParam: "sessionToken";
  catalogs: Record<McpAccessDomain, McpAccessCatalogDescriptor>;
  recommendedTransport: {
    type: "http";
    url: string;
    queryUrl: string;
    headers: Record<string, string>;
  };
}

type BuildMcpAccessBundleArgs = {
  workerOrigin: string;
  ownerEoa: string;
  userId: string;
  vaultId: string;
  vaultAddress: string;
  agentSubject: string;
  policyVersion: string;
  sessionId: string;
  grantId: string;
  allowedDomains: string[];
  expiresAt: string;
  sessionToken: string;
};

const scopedCatalogPath = (domain: McpAccessDomain) => `/mcp/scoped/${domain}`;
const scopedSsePath = (domain: McpAccessDomain) => `/sse/scoped/${domain}`;

const storageKey = (ownerEoa: string) => `neuralrate:mcp-access:${ownerEoa.trim().toLowerCase()}`;

const isExpired = (expiresAt: string) => {
  const expiresAtTs = Date.parse(expiresAt);
  return !Number.isFinite(expiresAtTs) || expiresAtTs <= Date.now();
};

export const loadStoredMcpAccessBundle = (ownerEoa: string): McpAccessBundle | null => {
  if (typeof window === "undefined" || !ownerEoa) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(storageKey(ownerEoa));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as McpAccessBundle;
    if (!parsed?.ownerEoa || parsed.ownerEoa.trim().toLowerCase() !== ownerEoa.trim().toLowerCase() || isExpired(parsed.expiresAt)) {
      window.sessionStorage.removeItem(storageKey(ownerEoa));
      return null;
    }

    return parsed;
  } catch {
    window.sessionStorage.removeItem(storageKey(ownerEoa));
    return null;
  }
};

export const storeMcpAccessBundle = (bundle: McpAccessBundle) => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(storageKey(bundle.ownerEoa), JSON.stringify(bundle));
};

export const clearStoredMcpAccessBundle = (ownerEoa: string | null | undefined) => {
  if (typeof window === "undefined" || !ownerEoa) {
    return;
  }

  window.sessionStorage.removeItem(storageKey(ownerEoa));
};

export const buildMcpAccessBundle = (args: BuildMcpAccessBundleArgs): McpAccessBundle => {
  const encodedToken = encodeURIComponent(args.sessionToken);
  const catalogs = (["state", "config", "benchmark", "execution"] as const).reduce(
    (acc, domain) => {
      const httpUrl = `${args.workerOrigin}${scopedCatalogPath(domain)}`;
      const sseUrl = `${args.workerOrigin}${scopedSsePath(domain)}`;
      acc[domain] = {
        domain,
        allowed: args.allowedDomains.includes(domain),
        httpUrl,
        sseUrl,
        queryHttpUrl: `${httpUrl}?sessionToken=${encodedToken}`,
        querySseUrl: `${sseUrl}?sessionToken=${encodedToken}`,
      };
      return acc;
    },
    {} as Record<McpAccessDomain, McpAccessCatalogDescriptor>,
  );

  return {
    success: true,
    ownerEoa: args.ownerEoa,
    userId: args.userId,
    vaultId: args.vaultId,
    vaultAddress: args.vaultAddress,
    agentSubject: args.agentSubject,
    policyVersion: args.policyVersion,
    sessionId: args.sessionId,
    grantId: args.grantId,
    allowedDomains: args.allowedDomains,
    expiresAt: args.expiresAt,
    sessionToken: args.sessionToken,
    headerName: "x-neuralrate-session-token",
    queryParam: "sessionToken",
    catalogs,
    recommendedTransport: {
      type: "http",
      url: catalogs.execution.httpUrl,
      queryUrl: catalogs.execution.queryHttpUrl,
      headers: {
        "x-neuralrate-session-token": args.sessionToken,
      },
    },
  };
};
