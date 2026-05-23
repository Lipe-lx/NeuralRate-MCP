import React, { useEffect, useState } from 'react';
import type { Pool } from '../App';
import { API_BASE_URL } from '../config';

interface Props {
  selectedPool: Pool | null;
  pools: Pool[];
}

interface NansenToken {
  token_name: string;
  token_symbol: string;
  token_address: string;
  chain: string;
  net_flow_1h_usd: number;
  net_flow_24h_usd: number;
  net_flow_7d_usd: number;
  net_flow_30d_usd: number;
  smart_money_holders: number;
}

interface NansenPoolSummary {
  poolId: string;
  symbol: string;
  project: string;
  tokenAddresses: string[];
  tokens: NansenToken[];
  totalNetFlow24h: number;
  totalNetFlow7d: number;
  topToken: NansenToken | null;
  signal: 'strong_inflow' | 'moderate_inflow' | 'neutral' | 'outflow';
  cacheStatus: Record<string, 'fresh' | 'stale' | 'miss' | 'negative'>;
}

interface NansenBatchResponse {
  status: 'success' | 'error' | 'disabled';
  message?: string;
  fetchedAt: string;
  poolSummaries: Record<string, NansenPoolSummary>;
}

const NansenRadar: React.FC<Props> = ({ selectedPool, pools }) => {
  const [data, setData] = useState<NansenBatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const poolSignature = pools.map((pool) => pool.pool).join('|');
  const selectedSummary = selectedPool ? data?.poolSummaries?.[selectedPool.pool] ?? null : null;
  const tokens = selectedSummary?.tokens || [];
  const topToken = selectedSummary?.topToken || null;
  const totalNetFlow24h = selectedSummary?.totalNetFlow24h || 0;
  const totalNetFlow7d = selectedSummary?.totalNetFlow7d || 0;

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      return;
    }

    if (pools.length === 0) {
      setData({
        status: 'error',
        fetchedAt: new Date().toISOString(),
        message: 'Yield Scanner has no pools available for Nansen enrichment.',
        poolSummaries: {},
      });
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`${API_BASE_URL}/nansen/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chain: 'mantle',
        pools: pools.map((pool) => ({
          pool: pool.pool,
          symbol: pool.symbol,
          project: pool.project,
          underlyingTokens: pool.underlyingTokens || [],
          stablecoin: pool.stablecoin,
          exposure: pool.exposure,
        })),
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        return response.json() as Promise<NansenBatchResponse>;
      })
      .then((nextData) => {
        if (!cancelled) {
          setData(nextData);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setData({
            status: 'error',
            fetchedAt: new Date().toISOString(),
            message: error.message || 'Nansen batch lookup failed.',
            poolSummaries: {},
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, poolSignature, pools]);

  const isUnavailable = data?.status === 'disabled' || data?.status === 'error';
  const hasSummary = Boolean(selectedSummary && selectedSummary.tokenAddresses.length > 0);
  const hasTokenData = tokens.length > 0;

  return (
    <section className="glass-panel animate-enter delay-300">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.125rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 2a10 10 0 0 1 10 10"></path>
          </svg>
          Nansen Radar
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={(event) => { event.stopPropagation(); setEnabled((value) => !value); }}
            style={{
              width: '32px', height: '18px', borderRadius: '9px',
              background: enabled ? 'var(--color-lime)' : 'rgba(255,255,255,0.1)',
              border: 'none', position: 'relative', cursor: 'pointer', transition: 'background 0.3s'
            }}
            title={enabled ? 'Disable Nansen API' : 'Enable Nansen API'}
          >
            <div style={{
              width: '14px', height: '14px', borderRadius: '50%', background: enabled ? 'var(--bg-deep)' : '#888',
              position: 'absolute', top: '2px', left: enabled ? '16px' : '2px', transition: 'left 0.3s'
            }}></div>
          </button>

          <a
            href="https://app.nansen.ai/smart-money"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textDecoration: 'none', background: 'rgba(255,255,255,0.05)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}
            onClick={(event) => event.stopPropagation()}
          >
            Source ↗
          </a>
        </div>
      </div>

      {!selectedPool ? (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0' }}>
          Select a pool to view smart money signals.
        </div>
      ) : !enabled ? (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0', fontSize: '0.875rem' }}>
          Nansen Radar disabled. Click toggle to hydrate the 10 Yield Scanner tokens once and reuse cache while you browse.
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div className="spinner" style={{ width: '24px', height: '24px', border: '3px solid var(--border-subtle)', borderTopColor: 'var(--color-lime)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.5rem' }}>Hydrating Nansen cache for visible Yield Scanner pools...</p>
        </div>
      ) : isUnavailable ? (
        <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            {data?.message || 'Nansen API unavailable'}
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.75rem' }}>
            Configure your API key in `.dev.vars` to enable
          </div>
          <a
            href="https://docs.nansen.ai/api/smart-money/netflows"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.7rem', color: 'var(--color-lime)', textDecoration: 'none' }}
          >
            Nansen API Docs →
          </a>
        </div>
      ) : !hasSummary ? (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0', fontSize: '0.85rem' }}>
          This pool does not expose usable underlying token addresses for Nansen enrichment yet.
        </div>
      ) : !hasTokenData ? (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0', fontSize: '0.85rem' }}>
          No Smart Money netflow snapshot was returned for {selectedPool.symbol}. Cached lookup status: {Object.values(selectedSummary.cacheStatus).join(', ') || 'n/a'}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Net Flow 24h</span>
            <span style={{ fontWeight: 600, color: totalNetFlow24h >= 0 ? 'var(--color-lime)' : 'var(--color-danger)' }}>
              {totalNetFlow24h >= 0 ? '+' : ''}${(totalNetFlow24h / 1_000_000).toFixed(2)}M
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Net Flow 7d</span>
            <span style={{ fontWeight: 600, color: totalNetFlow7d >= 0 ? 'var(--color-lime)' : 'var(--color-danger)' }}>
              {totalNetFlow7d >= 0 ? '+' : ''}${(totalNetFlow7d / 1_000_000).toFixed(2)}M
            </span>
          </div>

          <div>
            <div style={{ height: '6px', background: 'var(--bg-surface-elevated)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
              {totalNetFlow24h >= 0 ? (
                <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, var(--color-lime) 0%, rgba(223,246,81,0.3) 100%)', borderRadius: '3px' }}></div>
              ) : (
                <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, rgba(255,77,79,0.3) 0%, var(--color-danger) 100%)', borderRadius: '3px' }}></div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              <span>Outflow</span>
              <span>Inflow</span>
            </div>
          </div>

          {topToken && (
            <div style={{ padding: '0.6rem', background: 'rgba(223, 246, 81, 0.05)', borderRadius: '6px', borderLeft: '2px solid var(--color-lime)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Top Smart Money Token</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{topToken.token_symbol}</span>
                <span style={{ fontSize: '0.8rem', color: topToken.net_flow_24h_usd >= 0 ? 'var(--color-lime)' : 'var(--color-danger)', fontWeight: 600 }}>
                  {topToken.net_flow_24h_usd >= 0 ? '+' : ''}${(topToken.net_flow_24h_usd / 1_000_000).toFixed(2)}M
                </span>
              </div>
              {topToken.smart_money_holders > 0 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  {topToken.smart_money_holders} smart money wallets
                </div>
              )}
            </div>
          )}

          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5, padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
            {selectedSummary.signal === 'strong_inflow'
              ? `Strong institutional accumulation detected on ${selectedPool.symbol}.`
              : selectedSummary.signal === 'moderate_inflow'
              ? `Moderate smart money inflow for ${selectedPool.symbol}.`
              : selectedSummary.signal === 'outflow'
              ? `Smart money outflow detected for ${selectedPool.symbol} — proceed with caution.`
              : `Smart money flow is broadly neutral for ${selectedPool.symbol}.`}
          </div>

          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.8 }}>
            Cache source: {Object.values(selectedSummary.cacheStatus).join(', ')} • Snapshot: {new Date(data?.fetchedAt || Date.now()).toLocaleTimeString()}
          </div>
        </div>
      )}
    </section>
  );
};

export default NansenRadar;
