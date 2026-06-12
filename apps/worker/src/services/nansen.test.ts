import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPoolSummaries,
  NansenService,
  normalizeTokenAddresses,
  type NansenNetflowToken,
} from "./nansen";

class MemoryKv {
  private store = new Map<string, string>();

  async get(key: string, type?: "text" | "json") {
    const value = this.store.get(key);
    if (value === undefined) {
      return null;
    }

    if (type === "json") {
      return JSON.parse(value);
    }

    return value;
  }

  async put(key: string, value: string) {
    this.store.set(key, value);
  }
}

const tokenA = "0x1111111111111111111111111111111111111111";
const tokenB = "0x2222222222222222222222222222222222222222";

const makeToken = (overrides: Partial<NansenNetflowToken> = {}): NansenNetflowToken => ({
  token_name: "Token",
  token_symbol: "TOK",
  token_address: tokenA,
  chain: "mantle",
  net_flow_1h_usd: 10,
  net_flow_24h_usd: 100,
  net_flow_7d_usd: 500,
  net_flow_30d_usd: 1500,
  smart_money_holders: 3,
  ...overrides,
});

const withFetchMock = async (
  implementation: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  run: () => Promise<void>
) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = implementation as typeof fetch;

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

test("normalizeTokenAddresses filters placeholders, invalid values and duplicates", () => {
  const result = normalizeTokenAddresses([
    tokenA,
    tokenA.toUpperCase(),
    "0x0000000000000000000000000000000000000000",
    "0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111",
    "coingecko:usd-coin",
    "",
    tokenB,
  ]);

  assert.deepEqual(result, [tokenA, tokenB]);
});

test("getSmartMoneyFlowsBatch reuses fresh cache and avoids a second upstream call", async () => {
  const kv = new MemoryKv();
  const service = new NansenService(kv as unknown as KVNamespace, "test-key");
  let fetchCount = 0;

  await withFetchMock(async () => {
    fetchCount += 1;
    return new Response(JSON.stringify({
      data: [makeToken()],
    }), { status: 200 });
  }, async () => {
    const first = await service.getSmartMoneyFlowsBatch({ chain: "mantle", tokenAddresses: [tokenA] });
    assert.equal(first.status, "success");
    assert.equal(first.upstreamCalled, true);
    assert.equal(first.tokensByAddress[tokenA]?.length, 1);

    const second = await service.getSmartMoneyFlowsBatch({ chain: "mantle", tokenAddresses: [tokenA] });
    assert.equal(second.status, "success");
    assert.equal(second.upstreamCalled, false);
    assert.equal(second.cacheStatusByAddress[tokenA], "fresh");
    assert.equal(second.tokensByAddress[tokenA]?.length, 1);
  });

  assert.equal(fetchCount, 1);
});

test("Nansen API key is used only as the upstream authentication header", async () => {
  const kv = new MemoryKv();
  const service = new NansenService(kv as unknown as KVNamespace, "browser-private-key");

  await withFetchMock(async (_input, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("apikey"), "browser-private-key");
    assert.doesNotMatch(String(init?.body), /browser-private-key/);
    return new Response(JSON.stringify({ data: [makeToken()] }), { status: 200 });
  }, async () => {
    const result = await service.getSmartMoneyFlowsBatch({
      chain: "mantle",
      tokenAddresses: [tokenA],
    });
    assert.equal(result.status, "success");
  });
});

test("getSmartMoneyFlowsBatch fetches only cache misses when part of the batch is already warm", async () => {
  const kv = new MemoryKv();
  const service = new NansenService(kv as unknown as KVNamespace, "test-key");
  const requestedBodies: any[] = [];

  await withFetchMock(async (_input, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    requestedBodies.push(body);
    const rawAddresses = body.filters?.token_address;
    const addresses = Array.isArray(rawAddresses) ? rawAddresses : rawAddresses ? [rawAddresses] : [];

    return new Response(JSON.stringify({
      data: addresses.map((address: string) =>
        makeToken({
          token_address: address,
          token_symbol: address === tokenA ? "AAA" : "BBB",
          net_flow_24h_usd: address === tokenA ? 100 : 200,
        })
      ),
    }), { status: 200 });
  }, async () => {
    await service.getSmartMoneyFlowsBatch({ chain: "mantle", tokenAddresses: [tokenA] });
    const second = await service.getSmartMoneyFlowsBatch({ chain: "mantle", tokenAddresses: [tokenA, tokenB] });

    assert.equal(second.status, "success");
    assert.equal(second.tokensByAddress[tokenA]?.[0]?.token_symbol, "AAA");
    assert.equal(second.tokensByAddress[tokenB]?.[0]?.token_symbol, "BBB");
    assert.equal(second.cacheStatusByAddress[tokenA], "fresh");
    assert.equal(second.cacheStatusByAddress[tokenB], "fresh");
  });

  assert.equal(requestedBodies.length, 2);
  assert.equal(requestedBodies[1].filters.token_address, tokenB);
});

test("getSmartMoneyFlowsBatch retries individual requests when Nansen rejects batched token filters", async () => {
  const kv = new MemoryKv();
  const service = new NansenService(kv as unknown as KVNamespace, "test-key");
  const requestedBodies: any[] = [];

  await withFetchMock(async (_input, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    requestedBodies.push(body);
    const tokenFilter = body.filters?.token_address;

    if (Array.isArray(tokenFilter)) {
      return new Response(JSON.stringify({
        error: "Unknown field",
        message: "Field 'token_addresses' is not recognized. Please check the API documentation for valid request fields.",
      }), { status: 422 });
    }

    return new Response(JSON.stringify({
      data: [makeToken({
        token_address: tokenFilter,
        token_symbol: tokenFilter === tokenA ? "AAA" : "BBB",
        net_flow_24h_usd: tokenFilter === tokenA ? 100 : 200,
      })],
    }), { status: 200 });
  }, async () => {
    const result = await service.getSmartMoneyFlowsBatch({ chain: "mantle", tokenAddresses: [tokenA, tokenB] });

    assert.equal(result.status, "success");
    assert.equal(result.tokensByAddress[tokenA]?.[0]?.token_symbol, "AAA");
    assert.equal(result.tokensByAddress[tokenB]?.[0]?.token_symbol, "BBB");
    assert.equal(result.cacheStatusByAddress[tokenA], "fresh");
    assert.equal(result.cacheStatusByAddress[tokenB], "fresh");
  });

  assert.equal(requestedBodies.length, 3);
  assert.deepEqual(requestedBodies[0].filters.token_address, [tokenA, tokenB]);
  assert.equal(requestedBodies[1].filters.token_address, tokenA);
  assert.equal(requestedBodies[2].filters.token_address, tokenB);
});

test("getSmartMoneyFlowsBatch serves stale cache when upstream fails", async () => {
  const kv = new MemoryKv();
  const service = new NansenService(kv as unknown as KVNamespace, "test-key");
  const staleEntry = {
    status: "success",
    data: [makeToken({ token_address: tokenA, token_symbol: "STALE" })],
    fetchedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    softExpiresAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    hardExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };

  await kv.put(`nansen_token_mantle_${tokenA}`, JSON.stringify(staleEntry));

  await withFetchMock(async () => {
    throw new Error("upstream down");
  }, async () => {
    const result = await service.getSmartMoneyFlowsBatch({ chain: "mantle", tokenAddresses: [tokenA] });
    assert.equal(result.status, "success");
    assert.equal(result.cacheStatusByAddress[tokenA], "stale");
    assert.equal(result.tokensByAddress[tokenA]?.[0]?.token_symbol, "STALE");
    assert.match(result.message || "", /cached Nansen data/i);
  });
});

test("getSmartMoneyFlowsBatch writes and reuses negative cache entries", async () => {
  const kv = new MemoryKv();
  const service = new NansenService(kv as unknown as KVNamespace, "test-key");
  let fetchCount = 0;

  await withFetchMock(async () => {
    fetchCount += 1;
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  }, async () => {
    const first = await service.getSmartMoneyFlowsBatch({ chain: "mantle", tokenAddresses: [tokenA] });
    assert.equal(first.status, "success");
    assert.equal(first.cacheStatusByAddress[tokenA], "negative");
    assert.deepEqual(first.tokensByAddress[tokenA], []);

    const second = await service.getSmartMoneyFlowsBatch({ chain: "mantle", tokenAddresses: [tokenA] });
    assert.equal(second.status, "success");
    assert.equal(second.upstreamCalled, false);
    assert.equal(second.cacheStatusByAddress[tokenA], "negative");
  });

  assert.equal(fetchCount, 1);
});

test("buildPoolSummaries aggregates multi-asset pools and deduplicates token rows", () => {
  const summaries = buildPoolSummaries(
    [{
      pool: "pool-1",
      symbol: "USDT0-BSB",
      project: "fluxion-network",
      underlyingTokens: [tokenA, tokenB, tokenA],
      stablecoin: false,
      exposure: "multi",
    }],
    {
      [tokenA]: [makeToken({ token_address: tokenA, token_symbol: "USDT0", net_flow_24h_usd: 250000, net_flow_7d_usd: 800000 })],
      [tokenB]: [makeToken({ token_address: tokenB, token_symbol: "BSB", net_flow_24h_usd: -100000, net_flow_7d_usd: -200000 })],
    },
    {
      [tokenA]: "fresh",
      [tokenB]: "stale",
    }
  );

  assert.equal(summaries["pool-1"].tokens.length, 2);
  assert.equal(summaries["pool-1"].totalNetFlow24h, 150000);
  assert.equal(summaries["pool-1"].totalNetFlow7d, 600000);
  assert.equal(summaries["pool-1"].topToken?.token_symbol, "USDT0");
  assert.equal(summaries["pool-1"].signal, "moderate_inflow");
  assert.deepEqual(summaries["pool-1"].cacheStatus, {
    [tokenA]: "fresh",
    [tokenB]: "stale",
  });
});
