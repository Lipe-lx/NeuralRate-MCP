import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Pool } from '../App';
import { useApi } from '../hooks/useApi';

interface Props {
  selectedPool: Pool | null;
  nansenFlow?: number | null;
}

interface RiskFactorBase {
  score: number;
  max: number;
}

interface TvlDepthFactor extends RiskFactorBase {
  input: number;
}

interface VolumeUtilizationFactor extends RiskFactorBase {
  ratio: number;
  avgDailyVol: number;
}

interface ApySustainabilityFactor extends RiskFactorBase {
  sustainSub: number;
  volatilitySub: number;
  deviation: number;
  sigma: number;
}

interface YieldCompositionFactor extends RiskFactorBase {
  organicRatio: number;
  apyBase: number;
  apyReward: number;
}

interface AssetExposureFactor extends RiskFactorBase {
  ilRisk: string;
  stablecoin: boolean;
}

interface InstitutionalFlowFactor extends RiskFactorBase {
  netFlow: number;
  isEnabled?: boolean;
}

interface RiskFactors {
  tvlDepth: TvlDepthFactor;
  volumeUtilization: VolumeUtilizationFactor;
  apySustainability: ApySustainabilityFactor;
  yieldComposition: YieldCompositionFactor;
  assetExposure: AssetExposureFactor;
  institutionalFlow: InstitutionalFlowFactor;
}

interface RiskAssessResponse {
  totalScore: number;
  maxScore: number;
  classification: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: RiskFactors;
}

type FactorKey = keyof RiskFactors;

interface MetricRow {
  label: string;
  value: string;
}

interface BreakdownCardProps {
  id: FactorKey;
  title: string;
  score: number | string;
  max: number | string;
  summary: string;
  metrics: MetricRow[];
  calculation: string;
  note?: string;
  linkHref?: string;
  linkLabel?: string;
  isOpen: boolean;
  onToggle: (id: FactorKey) => void;
}

const factorCardStyle: React.CSSProperties = {
  marginBottom: '1rem',
  padding: '1rem 1.1rem',
  background: 'rgba(255,255,255,0.02)',
  borderRadius: '14px',
  border: '1px solid rgba(255,255,255,0.06)',
  transition: 'border-color 0.2s ease, background 0.2s ease, transform 0.2s ease',
};

const metricGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '0.65rem',
  marginTop: '0.9rem',
};

const metricCellStyle: React.CSSProperties = {
  padding: '0.75rem',
  borderRadius: '10px',
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.05)',
};

const formulaBoxStyle: React.CSSProperties = {
  marginTop: '0.9rem',
  padding: '0.85rem 0.95rem',
  borderRadius: '10px',
  background: 'rgba(223, 246, 81, 0.05)',
  border: '1px solid rgba(223, 246, 81, 0.12)',
};

const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);

const formatPercent = (value: number, decimals = 2) => `${value.toFixed(decimals)}%`;

const getClassificationColor = (classification: RiskAssessResponse['classification']) => {
  if (classification === 'LOW') return 'var(--color-lime)';
  if (classification === 'MEDIUM') return 'var(--color-warning)';
  if (classification === 'HIGH') return 'var(--color-danger)';
  return 'var(--color-danger)';
};

const getFactorAccent = (score: number | string, max: number | string) => {
  if (typeof score === 'string' || typeof max === 'string') return 'var(--text-secondary)';
  const numScore = Number(score);
  const numMax = Number(max);
  const ratio = numMax > 0 ? numScore / numMax : 0;
  if (ratio >= 0.8) return 'var(--color-lime)';
  if (ratio >= 0.55) return 'var(--color-warning)';
  return 'var(--color-danger)';
};

const FactorBar: React.FC<{ label: string; score: number | string; max: number | string }> = ({ label, score, max }) => {
  const isNA = typeof score === 'string' || typeof max === 'string' || Number(max) === 0;
  const ratio = isNA ? 0 : Number(score) / Number(max);
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: isNA ? 400 : 600 }}>
          {isNA ? 'N/A' : `${score}/${max}`}
        </span>
      </div>
      <div style={{ height: '5px', background: 'var(--bg-surface-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: isNA ? '0%' : `${ratio * 100}%`, background: isNA ? 'var(--bg-surface-elevated)' : `oklch(${0.5 + ratio * 0.4} 0.2 ${120 * ratio})`, borderRadius: '3px', transition: 'width 0.6s ease' }}></div>
      </div>
    </div>
  );
};

const BreakdownCard: React.FC<BreakdownCardProps> = ({
  id,
  title,
  score,
  max,
  summary,
  metrics,
  calculation,
  note,
  linkHref,
  linkLabel,
  isOpen,
  onToggle,
}) => {
  const accent = getFactorAccent(score, max);

  return (
    <div
      style={{
        ...factorCardStyle,
        background: isOpen ? 'rgba(255,255,255,0.035)' : factorCardStyle.background,
        borderColor: isOpen ? 'rgba(223, 246, 81, 0.18)' : 'rgba(255,255,255,0.06)',
        transform: isOpen ? 'translateX(-2px)' : 'none',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggle(id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle(id);
          }
        }}
        style={{ cursor: 'pointer', outline: 'none' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.35rem' }}>{title}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.55 }}>{summary}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem', flexShrink: 0 }}>
            <span style={{ color: accent, fontWeight: 700, fontSize: '0.95rem' }}>
              {typeof score === 'string' && typeof max === 'string' ? score : `${score} / ${max}`}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
              {isOpen ? 'Collapse' : 'Expand'}
            </span>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="animate-enter" style={{ marginTop: '0.95rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.95rem' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
            Metrics used
          </div>
          <div style={metricGridStyle}>
            {metrics.map((metric) => (
              <div key={metric.label} style={metricCellStyle}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '0.18rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {metric.label}
                </div>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>{metric.value}</div>
              </div>
            ))}
          </div>

          <div style={formulaBoxStyle}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-lime)', marginBottom: '0.3rem', fontWeight: 600 }}>
              Calculation used
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.65, margin: 0 }}>{calculation}</p>
          </div>

          {note && (
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '0.85rem 0 0', lineHeight: 1.6 }}>
              {note}
            </p>
          )}

          {linkHref && linkLabel && (
            <a
              href={linkHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.72rem', color: 'var(--color-lime)', textDecoration: 'none', display: 'inline-block', marginTop: '0.8rem', fontWeight: 500 }}
              onClick={(event) => event.stopPropagation()}
            >
              {linkLabel}
            </a>
          )}
        </div>
      )}
    </div>
  );
};

const RiskPanel: React.FC<Props> = ({ selectedPool, nansenFlow }) => {
  const { data, loading, execute } = useApi<RiskAssessResponse>('/risk-assess', {
    method: 'POST',
    immediate: false,
  });
  const [showDetails, setShowDetails] = useState(false);
  const [expandedFactor, setExpandedFactor] = useState<FactorKey | null>('tvlDepth');

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
        nansenSmartMoneyNetFlow: nansenFlow ?? null,
      });
    }
  }, [selectedPool, execute, nansenFlow]);

  useEffect(() => {
    if (!showDetails) {
      setExpandedFactor('tvlDepth');
    }
  }, [showDetails]);

  const f = data?.factors;
  const utilizationRatio = f?.volumeUtilization.ratio ?? 0;
  const isLendingMarket = !!f && f.volumeUtilization.avgDailyVol === 0 && utilizationRatio === 0;
  const organicRatioFraction = (f?.yieldComposition.organicRatio ?? 0) / 100;
  const totalYieldParts = (f?.yieldComposition.apyBase ?? 0) + (f?.yieldComposition.apyReward ?? 0);
  const apyMean30d = selectedPool?.apyMean30d || selectedPool?.apy || 0;
  const deviationFraction = apyMean30d > 0 && selectedPool ? Math.abs(selectedPool.apy - apyMean30d) / apyMean30d : 0;
  const sigmaPenalty = (selectedPool?.sigma || 0) > 10 ? 3 : (selectedPool?.sigma || 0) > 5 ? 1 : 0;
  const totalScoreLabel = data ? `${data.totalScore} / ${data.maxScore}` : null;

  const toggleFactor = (factorId: FactorKey) => {
    setExpandedFactor((current) => (current === factorId ? null : factorId));
  };

  return (
    <>
      <section
        className="glass-panel animate-enter delay-200"
        style={{ cursor: data ? 'pointer' : 'default', transition: 'all 0.2s' }}
        onClick={() => {
          if (data) {
            setShowDetails(true);
          }
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            Risk Assessment
          </h3>
          {data && (
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-lime)', background: 'rgba(223, 246, 81, 0.1)', border: '1px solid rgba(223, 246, 81, 0.3)', padding: '0.35rem 0.85rem', borderRadius: '6px', transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(223, 246, 81, 0.15)' }}>
              Open details
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
              <div style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1, color: getClassificationColor(data.classification) }}>
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
            <FactorBar label="Institutional Flow" score={f.institutionalFlow.isEnabled === false ? 'N/A' : f.institutionalFlow.score} max={f.institutionalFlow.isEnabled === false ? 'N/A' : f.institutionalFlow.max} />
          </>
        ) : (
          <div style={{ color: 'var(--color-danger)', textAlign: 'center' }}>Failed to assess risk.</div>
        )}
      </section>

      {showDetails && data && f && createPortal(
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease-out' }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowDetails(false);
            }
          }}
        >
          <div
            style={{
              width: 'min(720px, 96vw)',
              maxWidth: '100vw',
              background: 'var(--bg-deep)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              height: '100vh',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-15px 0 45px rgba(0,0,0,0.7)',
              animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                Risk Model Breakdown
              </h2>
              <button onClick={() => setShowDetails(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', transition: 'background 0.25s' }} onMouseOver={(event) => { event.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }} onMouseOut={(event) => { event.currentTarget.style.background = 'transparent'; }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div style={{ padding: '1rem 1.1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '14px', marginBottom: '1.5rem', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{selectedPool?.symbol}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{selectedPool?.project}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-lime)' }}>
                  {data.totalScore}
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/100</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: getClassificationColor(data.classification) }}>{data.classification} RISK</div>
              </div>
            </div>

            <div className="custom-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '1.5rem', lineHeight: 1.65 }}>
                NeuralRate combines six deterministic factors into a {totalScoreLabel} safety score. Click each card to inspect the metrics used and the exact scoring rule applied.
              </p>

              <BreakdownCard
                id="tvlDepth"
                title="1. TVL Depth & Liquidity"
                score={f.tvlDepth.score}
                max={f.tvlDepth.max}
                summary={`Protocol depth is being scored from ${formatUsd(f.tvlDepth.input)} of TVL, using tiered liquidity bands that reward deeper capital bases.`}
                metrics={[
                  { label: 'Protocol TVL', value: formatUsd(f.tvlDepth.input) },
                  { label: 'Factor score', value: `${f.tvlDepth.score} / ${f.tvlDepth.max}` },
                  { label: 'Pool APY', value: formatPercent(selectedPool?.apy || 0) },
                  { label: 'Project', value: selectedPool?.project || 'Unknown' },
                ]}
                calculation={
                  f.tvlDepth.input >= 100_000_000
                    ? `TVL is above $100M, so this factor receives the maximum 20 points.`
                    : f.tvlDepth.input >= 10_000_000
                      ? `TVL falls in the $10M-$100M band, so the score is 16 + ((TVL - $10M) / $90M) x 4, resulting in ${f.tvlDepth.score}.`
                      : f.tvlDepth.input >= 1_000_000
                        ? `TVL falls in the $1M-$10M band, so the score is 10 + ((TVL - $1M) / $9M) x 6, resulting in ${f.tvlDepth.score}.`
                        : f.tvlDepth.input >= 100_000
                          ? `TVL falls in the $100k-$1M band, so the score is 3 + ((TVL - $100k) / $900k) x 7, resulting in ${f.tvlDepth.score}.`
                          : `TVL is below $100k, so the score is (TVL / $100k) x 3, resulting in ${f.tvlDepth.score}.`
                }
                note="Higher TVL means deeper exit liquidity and better resilience against large withdrawals or liquidity shocks."
                linkHref={`https://defillama.com/protocol/${selectedPool?.project?.toLowerCase()}`}
                linkLabel="Verify on DefiLlama ->"
                isOpen={expandedFactor === 'tvlDepth'}
                onToggle={toggleFactor}
              />

              <BreakdownCard
                id="volumeUtilization"
                title="2. Volume / TVL Utilization"
                score={f.volumeUtilization.score}
                max={f.volumeUtilization.max}
                summary={
                  isLendingMarket
                    ? 'This pool behaves like a lending market, so NeuralRate uses TVL depth as a secure proxy instead of swap volume.'
                    : `Average daily volume is ${formatUsd(f.volumeUtilization.avgDailyVol)}, which translates to a ${f.volumeUtilization.ratio.toFixed(2)}% utilization ratio versus TVL.`
                }
                metrics={[
                  { label: 'Market type', value: isLendingMarket ? 'Lending / null volume' : 'DEX / active volume' },
                  { label: 'Avg daily volume', value: formatUsd(f.volumeUtilization.avgDailyVol) },
                  { label: 'Volume / TVL', value: `${f.volumeUtilization.ratio.toFixed(2)}%` },
                  { label: 'Factor score', value: `${f.volumeUtilization.score} / ${f.volumeUtilization.max}` },
                ]}
                calculation={
                  isLendingMarket
                    ? selectedPool && selectedPool.tvlUsd >= 10_000_000
                      ? `Because 1d and 7d volume are null, this is treated as a lending market. TVL is at least $10M, so the factor receives the maximum 15 points by the lending proxy rule.`
                      : selectedPool && selectedPool.tvlUsd >= 1_000_000
                        ? `Because 1d and 7d volume are null, this is treated as a lending market. TVL is between $1M and $10M, so the factor receives 12 points by the lending proxy rule.`
                        : `Because 1d and 7d volume are null, this is treated as a lending market. Smaller lending pools receive 8 points by the liquidity proxy rule.`
                    : utilizationRatio >= 1 && utilizationRatio <= 50
                      ? `The utilization ratio is inside the 1%-50% healthy activity zone, so the factor receives the full 15 points.`
                      : utilizationRatio > 50 && utilizationRatio <= 100
                        ? `The utilization ratio is above 50%, so the score uses 10 - ((ratio - 50) / 50) x 5 to reflect elevated turnover and wash-trading risk. That yields ${f.volumeUtilization.score}.`
                        : utilizationRatio > 100
                          ? `The utilization ratio is above 100%, so the score uses max(0, 5 - ((ratio - 100) / 100) x 5), which heavily penalizes suspiciously high turnover. That yields ${f.volumeUtilization.score}.`
                          : `The utilization ratio is below 1%, so the score uses ratio x 10 to penalize thin exit liquidity. That yields ${f.volumeUtilization.score}.`
                }
                note="Healthy DEX pools usually keep enough trading activity to prove exit liquidity without looking artificially churned."
                linkHref={`https://defillama.com/yields/pool/${selectedPool?.pool}`}
                linkLabel="Verify on DefiLlama Yields ->"
                isOpen={expandedFactor === 'volumeUtilization'}
                onToggle={toggleFactor}
              />

              <BreakdownCard
                id="apySustainability"
                title="3. APY Sustainability & Volatility"
                score={f.apySustainability.score}
                max={f.apySustainability.max}
                summary={`Current APY is ${formatPercent(selectedPool?.apy || 0)} versus a 30d mean of ${formatPercent(apyMean30d)}. The model combines a sustainability sub-score with volatility and sigma penalties.`}
                metrics={[
                  { label: 'Current APY', value: formatPercent(selectedPool?.apy || 0) },
                  { label: '30d mean APY', value: formatPercent(apyMean30d) },
                  { label: 'Deviation', value: `${f.apySustainability.deviation}%` },
                  { label: 'Sigma', value: `${f.apySustainability.sigma}` },
                  { label: 'Sustainability', value: `${f.apySustainability.sustainSub} / 10` },
                  { label: 'Volatility', value: `${f.apySustainability.volatilitySub} / 10` },
                ]}
                calculation={
                  `Sub-score A rates the absolute APY at ${f.apySustainability.sustainSub}/10. Sub-score B starts from deviation = |APY - mean| / mean = ${deviationFraction.toFixed(3)}, then applies the deviation bands and a sigma penalty of ${sigmaPenalty}. The final factor score is ${f.apySustainability.sustainSub} + ${f.apySustainability.volatilitySub} = ${f.apySustainability.score}.`
                }
                note="Sustainable pools avoid extreme yields and avoid sudden jumps away from their 30-day baseline."
                linkHref={`https://defillama.com/yields/pool/${selectedPool?.pool}`}
                linkLabel="Verify on DefiLlama Yields ->"
                isOpen={expandedFactor === 'apySustainability'}
                onToggle={toggleFactor}
              />

              <BreakdownCard
                id="yieldComposition"
                title="4. Yield Composition"
                score={f.yieldComposition.score}
                max={f.yieldComposition.max}
                summary={`Base APY contributes ${formatPercent(f.yieldComposition.apyBase)} and rewards contribute ${formatPercent(f.yieldComposition.apyReward)}. The model prefers yield that is organic rather than incentive-driven.`}
                metrics={[
                  { label: 'Base APY', value: formatPercent(f.yieldComposition.apyBase) },
                  { label: 'Reward APY', value: formatPercent(f.yieldComposition.apyReward) },
                  { label: 'Organic ratio', value: `${f.yieldComposition.organicRatio}%` },
                  { label: 'Total APY parts', value: formatPercent(totalYieldParts) },
                ]}
                calculation={
                  organicRatioFraction >= 0.8
                    ? `Organic ratio is ${organicRatioFraction.toFixed(2)}, which is at least 0.8, so the factor receives the full 15 points.`
                    : organicRatioFraction >= 0.5
                      ? `Organic ratio is ${organicRatioFraction.toFixed(2)}, so the score uses 10 + ((ratio - 0.5) / 0.3) x 5, resulting in ${f.yieldComposition.score}.`
                      : organicRatioFraction >= 0.2
                        ? `Organic ratio is ${organicRatioFraction.toFixed(2)}, so the score uses 5 + ((ratio - 0.2) / 0.3) x 5, resulting in ${f.yieldComposition.score}.`
                        : `Organic ratio is ${organicRatioFraction.toFixed(2)}, so the score uses ratio x 25, resulting in ${f.yieldComposition.score}.`
                }
                note="Organic yield usually comes from borrow demand or swap fees, while reward APY can decay quickly once incentives change."
                linkHref={`https://defillama.com/yields/pool/${selectedPool?.pool}`}
                linkLabel="Verify on DefiLlama Yields ->"
                isOpen={expandedFactor === 'yieldComposition'}
                onToggle={toggleFactor}
              />

              <BreakdownCard
                id="assetExposure"
                title="5. IL Risk & Asset Exposure"
                score={f.assetExposure.score}
                max={f.assetExposure.max}
                summary={`The pool is ${f.assetExposure.stablecoin ? 'stablecoin-based' : 'not stablecoin-based'} and its IL flag is "${f.assetExposure.ilRisk}". This factor captures directional asset risk plus impermanent loss exposure.`}
                metrics={[
                  { label: 'Stablecoin pool', value: f.assetExposure.stablecoin ? 'Yes' : 'No' },
                  { label: 'IL flag', value: f.assetExposure.ilRisk || 'Unknown' },
                  { label: 'Exposure tag', value: selectedPool?.exposure || 'Not provided' },
                  { label: 'Factor score', value: `${f.assetExposure.score} / ${f.assetExposure.max}` },
                ]}
                calculation={
                  f.assetExposure.stablecoin
                    ? 'Stablecoin pools receive the full 15 points because they minimize directional asset volatility and avoid classic IL scenarios.'
                    : f.assetExposure.ilRisk === 'no'
                      ? 'Non-stable pools without impermanent-loss exposure receive 12 points because they still carry market risk but avoid LP divergence.'
                      : f.assetExposure.ilRisk === 'yes'
                        ? 'Pools flagged with impermanent-loss exposure receive 5 points because correlated price moves can materially erode realized yield.'
                        : 'Unknown IL flags default to 8 points as a moderate-risk midpoint.'
                }
                note="This is the factor that most directly penalizes LP strategies exposed to volatile pairs and divergence loss."
                isOpen={expandedFactor === 'assetExposure'}
                onToggle={toggleFactor}
              />

              <BreakdownCard
                id="institutionalFlow"
                title="6. Institutional Flow Signal"
                score={f.institutionalFlow.isEnabled === false ? 'N/A' : f.institutionalFlow.score}
                max={f.institutionalFlow.isEnabled === false ? 'N/A' : f.institutionalFlow.max}
                summary={f.institutionalFlow.isEnabled === false ? 'Nansen Radar is disabled. The total safety score is proportionally scaled out of the remaining 85 points.' : `Current smart-money net flow is ${formatUsd(f.institutionalFlow.netFlow)}. The factor converts that directional flow into a confidence band from 3 to 15 points.`}
                metrics={[
                  { label: 'Net flow', value: f.institutionalFlow.isEnabled === false ? 'N/A' : formatUsd(f.institutionalFlow.netFlow) },
                  { label: 'Factor score', value: f.institutionalFlow.isEnabled === false ? 'N/A' : `${f.institutionalFlow.score} / ${f.institutionalFlow.max}` },
                  { label: 'Signal source', value: 'Nansen Smart Money' },
                  { label: 'Impact', value: f.institutionalFlow.isEnabled === false ? 'None' : f.institutionalFlow.netFlow >= 0 ? 'Positive flow' : 'Negative flow' },
                ]}
                calculation={
                  f.institutionalFlow.isEnabled === false ? 'Disabled (Ignored from Total)' :
                  f.institutionalFlow.netFlow > 500_000
                    ? 'Net flow is above $500k, so the factor receives 15 points.'
                    : f.institutionalFlow.netFlow > 100_000
                      ? 'Net flow is above $100k, so the factor receives 12 points.'
                      : f.institutionalFlow.netFlow > 0
                        ? 'Net flow is positive but below $100k, so the factor receives 10 points.'
                        : f.institutionalFlow.netFlow > -100_000
                          ? 'Net flow is slightly negative but above -$100k, so the factor receives 7 points.'
                          : 'Net flow is at or below -$100k, so the factor receives 3 points.'
                }
                note="This signal is currently directional context rather than a dominant input, but it helps distinguish capital inflow from risk-off behavior."
                linkHref="https://app.nansen.ai/smart-money"
                linkLabel="Verify on Nansen ->"
                isOpen={expandedFactor === 'institutionalFlow'}
                onToggle={toggleFactor}
              />

              <div style={{ padding: '1.15rem', background: 'rgba(223, 246, 81, 0.05)', border: '1px solid var(--color-lime)', borderRadius: '12px', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total Safety Score</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-lime)' }}>
                    {data.totalScore}
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 400 }}> / 100</span>
                  </span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.55rem', opacity: 0.85, lineHeight: 1.6 }}>
                  Total = TVL + Volume/TVL + APY Sustainability + Yield Composition + Asset Exposure + Institutional Flow.
                  Thresholds: 80+ LOW, 60+ MEDIUM, 40+ HIGH, below 40 CRITICAL.
                </div>
              </div>

              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Data Sources</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <a href={`https://defillama.com/yields/pool/${selectedPool?.pool}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textDecoration: 'none' }} onClick={(event) => event.stopPropagation()}>DefiLlama - TVL, volume, APY, yield composition</a>
                  <a href="https://app.nansen.ai/smart-money" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textDecoration: 'none' }} onClick={(event) => event.stopPropagation()}>Nansen - smart money flow signals</a>
                  <a href="https://fred.stlouisfed.org/series/DGS3MO" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textDecoration: 'none' }} onClick={(event) => event.stopPropagation()}>FRED - US T-Bill benchmark rate</a>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0.5; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (max-width: 640px) {
          .custom-scroll {
            padding-right: 0 !important;
          }
        }
      `}</style>
    </>
  );
};

export default RiskPanel;
