import React, { useEffect, useState } from 'react';
import type { Pool } from '../App';
import { useApi } from '../hooks/useApi';

interface Props {
  selectedPool: Pool | null;
}

const FactorBar: React.FC<{ label: string; score: number; max: number }> = ({ label, score, max }) => (
  <div style={{ marginBottom: '0.75rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{score}/{max}</span>
    </div>
    <div style={{ height: '5px', background: 'var(--bg-surface-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${(score / max) * 100}%`, background: `oklch(${0.5 + (score / max) * 0.4} 0.2 ${120 * (score / max)})`, borderRadius: '3px', transition: 'width 0.6s ease' }}></div>
    </div>
  </div>
);

const RiskPanel: React.FC<Props> = ({ selectedPool }) => {
  const { data, loading, execute } = useApi('/risk-assess', { 
    method: 'POST', 
    immediate: false 
  });

  useEffect(() => {
    if (selectedPool) {
      execute({
        protocolTvlUsd: selectedPool.tvlUsd,
        apy: selectedPool.apy,
        apyBase: selectedPool.apyBase || 0,
        apyReward: selectedPool.apyReward || 0,
        volumeUsd1d: selectedPool.volumeUsd1d ?? null,
        volumeUsd7d: selectedPool.volumeUsd7d ?? null,
        apyMean30d: selectedPool.apyMean30d || 0,
        ilRisk: selectedPool.ilRisk || 'no',
        stablecoin: selectedPool.stablecoin || false,
        sigma: selectedPool.sigma || 0,
        nansenSmartMoneyNetFlow: 0
      });
    }
  }, [selectedPool, execute]);

  const [showDetails, setShowDetails] = useState(false);

  const f = data?.factors;

  return (
    <>
      <section 
        className="glass-panel animate-enter delay-200" 
        style={{ cursor: data ? 'pointer' : 'default', transition: 'all 0.2s' }}
        onClick={() => { if (data) setShowDetails(true); }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            Risk Assessment
          </h3>
          {data && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              Expand →
            </span>
          )}
        </div>

        {!selectedPool ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
            Select a pool to analyze risk.
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div className="spinner" style={{ width: '24px', height: '24px', border: '3px solid var(--border-subtle)', borderTopColor: 'var(--color-lime)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
            <p style={{ color: 'var(--text-secondary)' }}>Running 6-factor analysis...</p>
          </div>
        ) : data && f ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1, color: data.classification === 'LOW' ? 'var(--color-lime)' : data.classification === 'MEDIUM' ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                {data.totalScore}
              </div>
              <div style={{ paddingBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Safety Score
                </div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {data.classification} RISK
                </div>
              </div>
            </div>

            <FactorBar label="TVL Depth" score={f.tvlDepth.score} max={f.tvlDepth.max} />
            <FactorBar label="Vol/TVL Utilization" score={f.volumeUtilization.score} max={f.volumeUtilization.max} />
            <FactorBar label="APY Sustainability" score={f.apySustainability.score} max={f.apySustainability.max} />
            <FactorBar label="Yield Composition" score={f.yieldComposition.score} max={f.yieldComposition.max} />
            <FactorBar label="IL & Asset Exposure" score={f.assetExposure.score} max={f.assetExposure.max} />
            <FactorBar label="Institutional Flow" score={f.institutionalFlow.score} max={f.institutionalFlow.max} />
          </>
        ) : (
          <div style={{ color: 'var(--color-danger)', textAlign: 'center' }}>Failed to assess risk.</div>
        )}
      </section>

      {/* === SIDEBAR OVERLAY === */}
      {showDetails && data && f && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDetails(false); }}
        >
          <div style={{ width: '440px', maxWidth: '100vw', background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-subtle)', height: '100vh', padding: '2rem', display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 40px rgba(0,0,0,0.6)', animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                Risk Model Breakdown
              </h2>
              <button onClick={() => setShowDetails(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.5rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Pool info banner */}
            <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-surface)', borderRadius: '8px', marginBottom: '1.5rem', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{selectedPool?.symbol}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{selectedPool?.project}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-lime)' }}>{data.totalScore}<span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/100</span></div>
                <div style={{ fontSize: '0.75rem', color: data.classification === 'LOW' ? 'var(--color-lime)' : 'var(--color-warning)' }}>{data.classification} RISK</div>
              </div>
            </div>

            {/* Scrollable content */}
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                StableSync uses a 6-factor deterministic model with continuous scoring curves. Each factor is weighted by its impact on capital safety.
              </p>

              {/* Factor 1: TVL Depth */}
              <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem' }}>1. TVL Depth & Liquidity</h4>
                  <span style={{ color: 'var(--color-lime)', fontWeight: 'bold', fontSize: '0.9rem' }}>{f.tvlDepth.score} / {f.tvlDepth.max}</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>
                  Pool TVL: <strong style={{ color: 'var(--text-primary)' }}>${(f.tvlDepth.input).toLocaleString()}</strong>
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0.25rem 0', opacity: 0.7 }}>
                  Logarithmic scale: ≥$100M → 20 | ≥$10M → 16+ | ≥$1M → 10+ | ≥$100k → 3+
                </p>
                <a href={`https://defillama.com/protocol/${selectedPool?.project?.toLowerCase()}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.65rem', color: 'var(--color-lime)', textDecoration: 'none', display: 'inline-block', marginTop: '0.4rem' }} onClick={(e) => e.stopPropagation()}>Verify on DefiLlama ↗</a>
              </div>

              {/* Factor 2: Volume/TVL */}
              <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem' }}>2. Volume / TVL Utilization</h4>
                  <span style={{ color: 'var(--color-lime)', fontWeight: 'bold', fontSize: '0.9rem' }}>{f.volumeUtilization.score} / {f.volumeUtilization.max}</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>
                  {f.volumeUtilization.avgDailyVol === 0 && f.volumeUtilization.ratio === 0 ? (
                    <><strong style={{ color: 'var(--text-primary)' }}>Lending Market Detected</strong> (Null Volume)</>
                  ) : (
                    <>Avg Daily Volume: <strong style={{ color: 'var(--text-primary)' }}>${(f.volumeUtilization.avgDailyVol).toLocaleString()}</strong></>
                  )}
                </p>
                {!(f.volumeUtilization.avgDailyVol === 0 && f.volumeUtilization.ratio === 0) && (
                  <div style={{ margin: '0.5rem 0', height: '4px', background: 'var(--bg-surface-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, f.volumeUtilization.ratio)}%`, height: '100%', background: f.volumeUtilization.ratio > 50 ? 'var(--color-warning)' : 'var(--color-lime)' }}></div>
                  </div>
                )}
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0.25rem 0', opacity: 0.7 }}>
                  {f.volumeUtilization.avgDailyVol === 0 && f.volumeUtilization.ratio === 0 
                    ? "Lending pools do not have trade volume. Scored securely via absolute TVL depth proxy."
                    : "Sweet spot: 1-50% → 15pts | > 50% wash risk | < 1% illiquid"
                  }
                </p>
                <a href={`https://defillama.com/yields/pool/${selectedPool?.pool}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.65rem', color: 'var(--color-lime)', textDecoration: 'none', display: 'inline-block', marginTop: '0.4rem' }} onClick={(e) => e.stopPropagation()}>Verify on DefiLlama Yields ↗</a>
              </div>

              {/* Factor 3: APY Sustainability */}
              <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem' }}>3. APY Sustainability & Volatility</h4>
                  <span style={{ color: 'var(--color-lime)', fontWeight: 'bold', fontSize: '0.9rem' }}>{f.apySustainability.score} / {f.apySustainability.max}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', margin: '0.5rem 0' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Sustainability: <strong style={{ color: 'var(--text-primary)' }}>{f.apySustainability.sustainSub}/10</strong>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Volatility: <strong style={{ color: 'var(--text-primary)' }}>{f.apySustainability.volatilitySub}/10</strong>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    30d Deviation: <strong style={{ color: 'var(--text-primary)' }}>{f.apySustainability.deviation}%</strong>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Sigma (σ): <strong style={{ color: 'var(--text-primary)' }}>{f.apySustainability.sigma}</strong>
                  </div>
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0.25rem 0', opacity: 0.7 }}>
                  Compares current APY vs 30-day mean. High deviation or sigma penalizes the score.
                </p>
                <a href={`https://defillama.com/yields/pool/${selectedPool?.pool}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.65rem', color: 'var(--color-lime)', textDecoration: 'none', display: 'inline-block', marginTop: '0.4rem' }} onClick={(e) => e.stopPropagation()}>Verify on DefiLlama Yields ↗</a>
              </div>

              {/* Factor 4: Yield Composition */}
              <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem' }}>4. Yield Composition</h4>
                  <span style={{ color: 'var(--color-lime)', fontWeight: 'bold', fontSize: '0.9rem' }}>{f.yieldComposition.score} / {f.yieldComposition.max}</span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', margin: '0.5rem 0' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Base APY: <strong style={{ color: 'var(--color-lime)' }}>{f.yieldComposition.apyBase.toFixed(2)}%</strong>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Reward APY: <strong style={{ color: 'var(--color-warning)' }}>{f.yieldComposition.apyReward.toFixed(2)}%</strong>
                  </div>
                </div>
                {/* Organic ratio bar */}
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    Organic Ratio: <strong style={{ color: 'var(--text-primary)' }}>{f.yieldComposition.organicRatio}%</strong>
                  </div>
                  <div style={{ height: '8px', background: 'var(--bg-surface-elevated)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ height: '100%', width: `${f.yieldComposition.organicRatio}%`, background: 'var(--color-lime)', borderRadius: '4px 0 0 4px' }}></div>
                    <div style={{ height: '100%', width: `${100 - f.yieldComposition.organicRatio}%`, background: 'var(--color-warning)', borderRadius: '0 4px 4px 0', opacity: 0.5 }}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>
                    <span>Organic (sustainable)</span>
                    <span>Incentivized (temporary)</span>
                  </div>
                </div>
                <a href={`https://defillama.com/yields/pool/${selectedPool?.pool}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.65rem', color: 'var(--color-lime)', textDecoration: 'none', display: 'inline-block', marginTop: '0.4rem' }} onClick={(e) => e.stopPropagation()}>Verify on DefiLlama Yields ↗</a>
              </div>

              {/* Factor 5: IL Risk */}
              <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem' }}>5. IL Risk & Asset Exposure</h4>
                  <span style={{ color: 'var(--color-lime)', fontWeight: 'bold', fontSize: '0.9rem' }}>{f.assetExposure.score} / {f.assetExposure.max}</span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', margin: '0.25rem 0' }}>
                  <span style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: f.assetExposure.stablecoin ? 'rgba(223, 246, 81, 0.15)' : 'rgba(255,255,255,0.05)', color: f.assetExposure.stablecoin ? 'var(--color-lime)' : 'var(--text-secondary)' }}>
                    {f.assetExposure.stablecoin ? '✓ Stablecoin' : '✗ Volatile Asset'}
                  </span>
                  <span style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: f.assetExposure.ilRisk === 'no' ? 'rgba(223, 246, 81, 0.15)' : 'rgba(255, 77, 79, 0.15)', color: f.assetExposure.ilRisk === 'no' ? 'var(--color-lime)' : 'var(--color-danger)' }}>
                    {f.assetExposure.ilRisk === 'no' ? '✓ No IL Risk' : '⚠ IL Exposure'}
                  </span>
                </div>
              </div>

              {/* Factor 6: Institutional Flow */}
              <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem' }}>6. Institutional Flow Signal</h4>
                  <span style={{ color: 'var(--color-lime)', fontWeight: 'bold', fontSize: '0.9rem' }}>{f.institutionalFlow.score} / {f.institutionalFlow.max}</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>
                  Smart Money Net Flow: <strong style={{ color: f.institutionalFlow.netFlow >= 0 ? 'var(--color-lime)' : 'var(--color-danger)' }}>${(f.institutionalFlow.netFlow).toLocaleString()}</strong>
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0.25rem 0', opacity: 0.7 }}>
                  Source: Nansen Smart Money Tracking — whale wallet aggregation
                </p>
                <a href="https://app.nansen.ai/smart-money" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.65rem', color: 'var(--color-lime)', textDecoration: 'none', display: 'inline-block', marginTop: '0.4rem' }} onClick={(e) => e.stopPropagation()}>Verify on Nansen ↗</a>
              </div>

              {/* Total */}
              <div style={{ padding: '1rem', background: 'rgba(223, 246, 81, 0.08)', borderRadius: '8px', border: '1px solid var(--color-lime)', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total Safety Score</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-lime)' }}>
                    {data.totalScore} <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/ 100</span>
                  </span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  ≥80 LOW RISK | ≥60 MEDIUM | ≥40 HIGH | {'<'}40 CRITICAL
                </div>
              </div>

              {/* Data Sources */}
              <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Data Sources</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <a href={`https://defillama.com/yields/pool/${selectedPool?.pool}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>📊 DefiLlama — TVL, Volume, APY, Yield Composition</a>
                  <a href="https://app.nansen.ai/smart-money" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>🐋 Nansen — Smart Money Flow Signals</a>
                  <a href="https://fred.stlouisfed.org/series/DGS3MO" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>🏛️ FRED — US T-Bill Benchmark Rate</a>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0.5; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
};

export default RiskPanel;
