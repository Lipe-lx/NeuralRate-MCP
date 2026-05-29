import React from 'react';
import type { Pool } from '../App';
import { ApySparkline } from './ApySparkline';
import { MANTLE_CHAIN_NAME } from '../config';

interface Props {
  pools: Pool[];
  loading: boolean;
  onSelectPool: (pool: Pool) => void;
  selectedPool: Pool | null;
}

const YieldScanner: React.FC<Props> = ({ pools, loading, onSelectPool, selectedPool }) => {
  return (
    <section className="glass-panel animate-enter delay-100" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
        <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
          </svg>
          Yield Scanner
        </h2>
        <div style={{ fontSize: '0.875rem', color: 'var(--color-lime)', background: 'var(--color-lime-glow)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
          Live on {MANTLE_CHAIN_NAME}
        </div>
      </div>

      {loading ? (
        <div style={{ height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', flex: 1 }}>
          <div className="spinner" style={{ width: '24px', height: '24px', border: '3px solid var(--border-subtle)', borderTopColor: 'var(--color-lime)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <span style={{ color: 'var(--text-secondary)' }}>Scanning blockchain opportunities...</span>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      ) : pools.length === 0 ? (
        <div style={{ height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', flex: 1, color: 'var(--text-secondary)' }}>
          <div>No yield pools available yet.</div>
          <div style={{ fontSize: '0.8rem' }}>Retry in a moment or verify API/provider health in the Verify page.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
          {[...pools].sort((a, b) => b.apy - a.apy).map((p, idx) => {
            const isSelected = p.pool === selectedPool?.pool;
            return (
              <div key={idx} style={{ 
                display: 'grid', 
                gridTemplateColumns: 'minmax(120px, 1fr) 2fr minmax(120px, 1fr)',
                gap: '1rem',
                alignItems: 'center', 
                padding: '1.25rem 0.5rem', 
                background: isSelected 
                  ? 'rgba(223, 246, 81, 0.04)' 
                  : 'transparent', 
                border: 'none',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                position: 'relative',
              }}
              onClick={() => onSelectPool(p)}
              onMouseOver={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.015)';
                }
              }}
              onMouseOut={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
              >
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: '20%',
                    bottom: '20%',
                    width: '3px',
                    background: 'var(--color-lime)',
                    boxShadow: '0 0 8px var(--color-lime-glow)'
                  }} />
                )}
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.symbol}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.project}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: '0 1rem' }}>
                  <ApySparkline poolId={p.pool} />
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div className="text-lime" style={{ fontSize: '1.3rem', fontWeight: 700 }}>{p.apy.toFixed(2)}% APY</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>TVL: ${(p.tvlUsd / 1000000).toFixed(1)}M</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default YieldScanner;
