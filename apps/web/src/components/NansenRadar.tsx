import React, { useEffect, useState } from 'react';
import type { Pool } from '../App';

interface Props {
  selectedPool: Pool | null;
}

const NansenRadar: React.FC<Props> = ({ selectedPool }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!selectedPool || !enabled) {
      if (!enabled) setData(null);
      return;
    }
    
    setLoading(true);
    fetch(`http://localhost:8787/api/nansen/${selectedPool.symbol}`)
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setData({ status: 'error' });
        setLoading(false);
      });
  }, [selectedPool, enabled]);

  const isDisabled = !data || data.status === 'disabled' || data.status === 'error';
  const tokens = data?.data || [];
  const topToken = tokens.length > 0 ? tokens[0] : null;

  // Calculate aggregated flows from all returned tokens
  const totalNetFlow24h = tokens.reduce((acc: number, t: any) => acc + (t.net_flow_24h_usd || 0), 0);
  const totalNetFlow7d = tokens.reduce((acc: number, t: any) => acc + (t.net_flow_7d_usd || 0), 0);

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
          {/* Minimalist Toggle */}
          <button 
            onClick={(e) => { e.stopPropagation(); setEnabled(!enabled); }}
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
            onClick={(e) => e.stopPropagation()}
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
          Nansen Radar disabled. Click toggle to enable.
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div className="spinner" style={{ width: '24px', height: '24px', border: '3px solid var(--border-subtle)', borderTopColor: 'var(--color-lime)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.5rem' }}>Querying Nansen Smart Money API...</p>
        </div>
      ) : isDisabled ? (
        <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            {data?.message || 'Nansen API unavailable'}
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.75rem' }}>
            Configure your API key in .dev.vars to enable
          </div>
          <a 
            href="https://docs.nansen.ai/first-api-call" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ fontSize: '0.7rem', color: 'var(--color-lime)', textDecoration: 'none' }}
          >
            Nansen API Docs →
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Aggregated Net Flow */}
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

          {/* Flow direction bar */}
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

          {/* Top token */}
          {topToken && (
            <div style={{ padding: '0.6rem', background: 'rgba(223, 246, 81, 0.05)', borderRadius: '6px', borderLeft: '2px solid var(--color-lime)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Top Smart Money Token</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{topToken.token_symbol}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-lime)', fontWeight: 600 }}>
                  +${(topToken.net_flow_24h_usd / 1_000_000).toFixed(2)}M
                </span>
              </div>
              {topToken.smart_money_holders > 0 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  {topToken.smart_money_holders} smart money wallets
                </div>
              )}
            </div>
          )}

          {/* Institutional signal */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5, padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
            {totalNetFlow24h > 1_000_000 
              ? `🟢 Strong institutional accumulation detected on ${selectedPool.symbol}`
              : totalNetFlow24h > 0 
              ? `🟡 Moderate smart money inflow for ${selectedPool.symbol}`
              : `🔴 Smart money outflow detected — proceed with caution`
            }
          </div>
        </div>
      )}
    </section>
  );
};

export default NansenRadar;
