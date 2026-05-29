import React, { useState, useMemo } from 'react';
import McpConnectModal from './McpConnectModal';

interface HomePanelProps {
  onNavigate: (path: string) => void;
}

const HomePanel: React.FC<HomePanelProps> = ({ onNavigate }) => {
  // Mcp Modal State
  const [isMcpModalOpen, setIsMcpModalOpen] = useState<boolean>(false);

  // Simulator State
  const [tvl, setTvl] = useState<number>(25000000); // Default $25M
  const [volumeRatio, setVolumeRatio] = useState<number>(15); // Default 15% (healthy)
  const [apy, setApy] = useState<number>(8.5); // Default 8.5%
  const [volatility, setVolatility] = useState<'low' | 'medium' | 'high'>('low');
  const [organicRatio, setOrganicRatio] = useState<number>(75); // Default 75% organic
  const [isStablecoin, setIsStablecoin] = useState<boolean>(true);
  const [ilRisk, setIlRisk] = useState<'yes' | 'no'>('no');
  const [netFlow, setNetFlow] = useState<number>(150000); // Default $150k inflow

  // Calculator Logic based on the exact same formulas in RiskPanel.tsx
  const scoreBreakdown = useMemo(() => {
    // 1. TVL Score (max 20)
    let tvlScore = 0;
    if (tvl >= 100000000) {
      tvlScore = 20;
    } else if (tvl >= 10000000) {
      tvlScore = 16 + ((tvl - 10000000) / 90000000) * 4;
    } else if (tvl >= 1000000) {
      tvlScore = 10 + ((tvl - 1000000) / 9000000) * 6;
    } else if (tvl >= 100000) {
      tvlScore = 3 + ((tvl - 100000) / 900000) * 7;
    } else {
      tvlScore = (tvl / 100000) * 3;
    }
    tvlScore = parseFloat(tvlScore.toFixed(1));

    // 2. Volume Utilization (max 15)
    let volScore = 0;
    if (volumeRatio >= 1 && volumeRatio <= 50) {
      volScore = 15;
    } else if (volumeRatio > 50 && volumeRatio <= 100) {
      volScore = 10 - ((volumeRatio - 50) / 50) * 5;
    } else if (volumeRatio > 100) {
      volScore = Math.max(0, 5 - ((volumeRatio - 100) / 100) * 5);
    } else {
      volScore = volumeRatio * 10;
    }
    volScore = parseFloat(volScore.toFixed(1));

    // 3. APY Sustainability & Volatility (max 20)
    // Sustainability sub-score out of 10
    let sustainSub = 10;
    if (apy > 10) {
      sustainSub = Math.max(2, 10 - ((apy - 10) / 40) * 8);
    }
    // Volatility sub-score out of 10
    let volatilitySub = 10;
    if (volatility === 'medium') volatilitySub = 7;
    if (volatility === 'high') volatilitySub = 3;

    const apyScore = parseFloat((sustainSub + volatilitySub).toFixed(1));

    // 4. Yield Composition (max 15)
    let compScore = 0;
    const ratioFraction = organicRatio / 100;
    if (ratioFraction >= 0.8) {
      compScore = 15;
    } else if (ratioFraction >= 0.5) {
      compScore = 10 + ((ratioFraction - 0.5) / 0.3) * 5;
    } else if (ratioFraction >= 0.2) {
      compScore = 5 + ((ratioFraction - 0.2) / 0.3) * 5;
    } else {
      compScore = (ratioFraction / 0.2) * 5;
    }
    compScore = parseFloat(compScore.toFixed(1));

    // 5. Asset Exposure & IL (max 15)
    let assetScore = 8;
    if (isStablecoin) {
      assetScore = 15;
    } else if (ilRisk === 'no') {
      assetScore = 12;
    } else if (ilRisk === 'yes') {
      assetScore = 5;
    }
    assetScore = parseFloat(assetScore.toFixed(1));

    // 6. Institutional Flow (max 15)
    let flowScore = 10;
    if (netFlow > 500000) {
      flowScore = 15;
    } else if (netFlow > 100000) {
      flowScore = 12;
    } else if (netFlow > 0) {
      flowScore = 10;
    } else if (netFlow > -100000) {
      flowScore = 7;
    } else {
      flowScore = 3;
    }

    const total = parseFloat((tvlScore + volScore + apyScore + compScore + assetScore + flowScore).toFixed(1));

    let classification: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (total >= 80) classification = 'LOW';
    else if (total >= 60) classification = 'MEDIUM';
    else if (total >= 40) classification = 'HIGH';
    else classification = 'CRITICAL';

    return {
      tvlScore,
      volScore,
      apyScore,
      compScore,
      assetScore,
      flowScore,
      total,
      classification,
    };
  }, [tvl, volumeRatio, apy, volatility, organicRatio, isStablecoin, ilRisk, netFlow]);

  const getRatingBadgeColor = (classification: string) => {
    if (classification === 'LOW') return 'var(--color-success)';
    if (classification === 'MEDIUM') return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  const getRatingLetter = (total: number) => {
    if (total >= 92) return 'A+';
    if (total >= 85) return 'A';
    if (total >= 80) return 'A-';
    if (total >= 75) return 'B+';
    if (total >= 70) return 'B';
    if (total >= 60) return 'C';
    if (total >= 40) return 'D';
    return 'F';
  };

  // State for dynamic features highlight
  const [activeFeature, setActiveFeature] = useState<number>(0);

  return (
    <div className="home-panel-wrapper animate-enter">
      {/* 1. HERO SECTION */}
      <section className="home-hero">
        <div className="hero-status-tag">
          <span className="pulse-dot"></span>
          <span>Mantle Sepolia Network Active</span>
        </div>
        <h1 className="hero-headline text-gradient">
          Autonomous Yield Intelligence.<br />
          Deterministic Risk Mitigation.
        </h1>
        <p className="hero-subhead">
          NeuralRate empowers yield operators with mathematical rigor. Scan opportunities, simulate deterministic risk parameters, and automate secure strategies through non-custodial Safe vaults.
        </p>

        <div className="hero-actions" style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn-premium btn-premium-wallet hero-btn" onClick={() => onNavigate('/app')}>
            <span>Launch Operator Terminal</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="btn-arrow">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>

          <button 
            className="btn-premium btn-premium-agent hero-btn" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={() => setIsMcpModalOpen(true)}
            title="Connect AI Agent to MCP"
          >
            <span className="agent-dot"></span>
            <span>AGENT ACCESS</span>
          </button>
        </div>
      </section>

      {/* 2. DYNAMIC RISK SIMULATOR */}
      <section className="home-section glass-card-premium">
        <div className="section-header-compact">
          <div className="section-kicker">Interactive Proof-of-Concept</div>
          <h2 className="section-title">Deterministic 6-Factor Risk Simulator</h2>
          <p className="section-desc">
            Interact with the actual NeuralRate risk model. Adjust protocol parameters below to see the Dynamic Safety Score and Automated Action Recommendation update instantly.
          </p>
        </div>

        <div className="simulator-grid">
          {/* Controls Panel */}
          <div className="simulator-controls">
            {/* TVL Slider */}
            <div className="control-group">
              <div className="control-header">
                <label>1. Protocol TVL</label>
                <span className="control-value">${(tvl / 1000000).toFixed(1)}M</span>
              </div>
              <input
                type="range"
                min="50000"
                max="150000000"
                step="500000"
                value={tvl}
                onChange={(e) => setTvl(Number(e.target.value))}
                className="simulator-slider"
              />
              <span className="control-caption">Higher TVL reduces exit liquidity constraints.</span>
            </div>

            {/* Volume Utilization Slider */}
            <div className="control-group">
              <div className="control-header">
                <label>2. Volume / TVL Utilization</label>
                <span className="control-value">{volumeRatio.toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="150"
                step="1"
                value={volumeRatio}
                onChange={(e) => setVolumeRatio(Number(e.target.value))}
                className="simulator-slider"
              />
              <span className="control-caption">Healthy utilization proves depth; &gt;100% flags artificial activity.</span>
            </div>

            {/* APY Slider & Volatility */}
            <div className="control-group-split">
              <div className="control-group" style={{ flex: 1 }}>
                <div className="control-header">
                  <label>3. Current APY</label>
                  <span className="control-value">{apy.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="60"
                  step="0.5"
                  value={apy}
                  onChange={(e) => setApy(Number(e.target.value))}
                  className="simulator-slider"
                />
              </div>
              <div className="control-group" style={{ width: '130px' }}>
                <div className="control-header">
                  <label>Volatility</label>
                </div>
                <select
                  value={volatility}
                  onChange={(e) => setVolatility(e.target.value as 'low' | 'medium' | 'high')}
                  style={{ width: '100%', padding: '0.55rem' }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Yield Composition Slider */}
            <div className="control-group">
              <div className="control-header">
                <label>4. Organic Yield Ratio</label>
                <span className="control-value">{organicRatio}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={organicRatio}
                onChange={(e) => setOrganicRatio(Number(e.target.value))}
                className="simulator-slider"
              />
              <span className="control-caption">Prefer borrow fees/swap fees over temporary token rewards.</span>
            </div>

            {/* Asset Exposure controls */}
            <div className="control-group-split">
              <div className="control-group" style={{ flex: 1 }}>
                <div className="control-header">
                  <label>5. Asset Class</label>
                </div>
                <div className="radio-toggle-group">
                  <button
                    className={`radio-toggle-btn ${isStablecoin ? 'active' : ''}`}
                    onClick={() => {
                      setIsStablecoin(true);
                      setIlRisk('no');
                    }}
                  >
                    Stablecoin
                  </button>
                  <button
                    className={`radio-toggle-btn ${!isStablecoin ? 'active' : ''}`}
                    onClick={() => setIsStablecoin(false)}
                  >
                    Volatile Asset
                  </button>
                </div>
              </div>

              {!isStablecoin && (
                <div className="control-group" style={{ width: '130px' }}>
                  <div className="control-header">
                    <label>IL Exposure</label>
                  </div>
                  <select
                    value={ilRisk}
                    onChange={(e) => setIlRisk(e.target.value as 'yes' | 'no')}
                    style={{ width: '100%', padding: '0.55rem' }}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes (LP)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Institutional Flow Slider */}
            <div className="control-group">
              <div className="control-header">
                <label>6. Smart Money Net Flow (24h)</label>
                <span className="control-value">
                  {netFlow >= 0 ? `+$${(netFlow / 1000).toFixed(0)}k` : `-$${(Math.abs(netFlow) / 1000).toFixed(0)}k`}
                </span>
              </div>
              <input
                type="range"
                min="-250000"
                max="750000"
                step="25000"
                value={netFlow}
                onChange={(e) => setNetFlow(Number(e.target.value))}
                className="simulator-slider"
              />
              <span className="control-caption">Signals capital flight or strong institutional consolidation.</span>
            </div>
          </div>

          {/* Results Panel */}
          <div className="simulator-results">
            <div className="result-metric-card">
              <div className="result-header">
                <span className="result-label">Dynamic Safety Rating</span>
                <span
                  className="rating-badge"
                  style={{
                    backgroundColor: getRatingBadgeColor(scoreBreakdown.classification),
                    color: 'var(--bg-deep)',
                    fontWeight: 800,
                  }}
                >
                  {scoreBreakdown.classification} RISK
                </span>
              </div>

              <div className="rating-display-core">
                <span className="rating-grade-text">{getRatingLetter(scoreBreakdown.total)}</span>
                <div className="rating-score-trail">
                  <span className="score-main">{scoreBreakdown.total.toFixed(0)}</span>
                  <span className="score-max">/100</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${scoreBreakdown.total}%`,
                    background: getRatingBadgeColor(scoreBreakdown.classification),
                    boxShadow: `0 0 14px ${getRatingBadgeColor(scoreBreakdown.classification)}80`,
                  }}
                />
              </div>
            </div>

            {/* Recommendation Decision Block */}
            <div className="recommendation-decision-block">
              <div className="decision-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>Automated Recommendation</span>
              </div>

              {scoreBreakdown.total >= 80 ? (
                <div className="decision-content decision-low">
                  <h4>✔ ALLOCATION CAPABLE</h4>
                  <p>
                    The pool parameters reflect high stability and deep liquidity. Safe automation vaults are authorized to allocate up to 100% of defined strategy limits.
                  </p>
                </div>
              ) : scoreBreakdown.total >= 60 ? (
                <div className="decision-content decision-medium">
                  <h4>⚡ CAUTIOUS ALLOWED</h4>
                  <p>
                    Moderate risk detected due to score degradation. Vault allocations are constrained to 40% of limits with tighter slippage and hourly health check requirements.
                  </p>
                </div>
              ) : (
                <div className="decision-content decision-high">
                  <h4>❌ AUTOMATION BLOCKED</h4>
                  <p>
                    High risk alert. Score has fallen below the safety threshold. Automation engine is hard-blocked from allocating capital. Existing positions undergo auto-withdrawal checks.
                  </p>
                </div>
              )}
            </div>

            {/* Breakdown Mini-List */}
            <div className="score-mini-breakdown">
              <div className="breakdown-title">Scoring Factor Breakdown</div>
              <div className="breakdown-list">
                <div className="breakdown-item">
                  <span>TVL Depth & Liquidity</span>
                  <strong>{scoreBreakdown.tvlScore} / 20</strong>
                </div>
                <div className="breakdown-item">
                  <span>Vol/TVL Utilization</span>
                  <strong>{scoreBreakdown.volScore} / 15</strong>
                </div>
                <div className="breakdown-item">
                  <span>APY Sustainability</span>
                  <strong>{scoreBreakdown.apyScore} / 20</strong>
                </div>
                <div className="breakdown-item">
                  <span>Yield Composition</span>
                  <strong>{scoreBreakdown.compScore} / 15</strong>
                </div>
                <div className="breakdown-item">
                  <span>Asset Exposure & IL</span>
                  <strong>{scoreBreakdown.assetScore} / 15</strong>
                </div>
                <div className="breakdown-item">
                  <span>Institutional Flow</span>
                  <strong>{scoreBreakdown.flowScore} / 15</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CORE FEATURES INTERACTIVE GRID */}
      <section className="home-section">
        <div className="section-header-compact" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="section-kicker">Core Architecture</div>
          <h2 className="section-title">Engineered For Institutional Safety</h2>
        </div>

        <div className="features-grid">
          <div
            className={`feature-card ${activeFeature === 0 ? 'active' : ''}`}
            onMouseEnter={() => setActiveFeature(0)}
          >
            <div className="feature-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <h3>1. Deterministic Risk Scopes</h3>
            <p>
              NeuralRate relies on strict mathematical boundaries. Every factor (from TVL depth to DEX utilization) is calculated on-chain, eliminating arbitrary opinions.
            </p>
            <span className="card-dot-indicator"></span>
          </div>

          <div
            className={`feature-card ${activeFeature === 1 ? 'active' : ''}`}
            onMouseEnter={() => setActiveFeature(1)}
          >
            <div className="feature-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
            </div>
            <h3>2. Recommend-First Advisory</h3>
            <p>
              Compare pools and review yield advice completely free in recommendation-only mode. Onboard and fund automation vaults only when you trust the advice.
            </p>
            <span className="card-dot-indicator"></span>
          </div>

          <div
            className={`feature-card ${activeFeature === 2 ? 'active' : ''}`}
            onMouseEnter={() => setActiveFeature(2)}
          >
            <div className="feature-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h3>3. Safe Smart Automation</h3>
            <p>
              Execute strategy steps through non-custodial Safe smart accounts. Guardrails are enforced via cryptographically signed operator policies.
            </p>
            <span className="card-dot-indicator"></span>
          </div>
        </div>
      </section>

      {/* 4. VISUAL TIMELINE: DECISION LINEAGE */}
      <section className="home-section glass-card-premium">
        <div className="section-header-compact">
          <div className="section-kicker">Data Verifiability</div>
          <h2 className="section-title">The Cryptographic Decision Lifecycle</h2>
          <p className="section-desc">
            How NeuralRate guarantees public auditing from initial yield parameters to the final Mantle blockchain transaction.
          </p>
        </div>

        <div className="timeline-trail">
          <div className="timeline-node">
            <div className="node-marker">1</div>
            <div className="node-content">
              <h4>Yield Scan & Parameter Assembly</h4>
              <p>
                DEX pools and lending rates are scraped. Key metrics (TVL, stable ratio, average daily volume) are locked in a deterministic envelope.
              </p>
            </div>
          </div>

          <div className="timeline-node">
            <div className="node-marker">2</div>
            <div className="node-content">
              <h4>Deterministic Scoring Engine</h4>
              <p>
                Metrics are parsed through our open-source 6-factor scoring spec. An immutable recommendation rationale is generated with exact mathematical inputs.
              </p>
            </div>
          </div>

          <div className="timeline-node">
            <div className="node-marker">3</div>
            <div className="node-content">
              <h4>Cryptographic Attestation</h4>
              <p>
                The advisor generates a unique decision hash. This hash binds the input metrics, risk calculations, and resulting action plan together forever.
              </p>
            </div>
          </div>

          <div className="timeline-node">
            <div className="node-marker">4</div>
            <div className="node-content">
              <h4>On-Chain Anchoring (Mantle)</h4>
              <p>
                The transaction is pushed to the Mantle Sepolia network. The `DecisionReceiptRegistry` anchors the hash, creating a permanently verifiable audit trail.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. TECH INTEGRATIONS */}
      <section className="home-section" style={{ textAlign: 'center' }}>
        <div className="section-header-compact">
          <div className="section-kicker">Built on standard web3 infrastructure</div>
          <h2 className="section-title" style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>Powering the NeuralRate Stack</h2>
        </div>

        <div className="integrations-grid">
          <div className="integration-badge">
            <span className="badge-logo font-mono">Mantle</span>
            <span>Mantle Network</span>
          </div>
          <div className="integration-badge">
            <span className="badge-logo font-mono">Safe</span>
            <span>Safe Contracts</span>
          </div>
          <div className="integration-badge">
            <span className="badge-logo font-mono">Privy</span>
            <span>Privy Auth</span>
          </div>
          <div className="integration-badge">
            <span className="badge-logo font-mono">WebMCP</span>
            <span>Agent Web Tools</span>
          </div>
        </div>
      </section>

      {/* 6. SEMANTIC FAQ ACCORDIONS */}
      <section className="home-section" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="section-header-compact" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="section-kicker">Operator Answers</div>
          <h2 className="section-title">Frequently Asked Questions</h2>
        </div>

        <div className="faq-container">
          <details className="faq-item" open>
            <summary className="faq-summary">Is NeuralRate custodial?</summary>
            <div className="faq-content">
              <p>
                No. NeuralRate is completely non-custodial. Funds stay inside your customized Safe smart account. The automated operator can only execute strategies matching policies that you have explicitly signed and registered on-chain.
              </p>
            </div>
          </details>

          <details className="faq-item">
            <summary className="faq-summary">What is recommend-only mode?</summary>
            <div className="faq-content">
              <p>
                Recommend-only mode lets you scan yield opportunities and review risk profiles completely free, without generating any wallet setups or funding vaults. It serves as an advisory decision terminal until you explicitly decide to turn on execution automation.
              </p>
            </div>
          </details>

          <details className="faq-item">
            <summary className="faq-summary">How does the 6-factor risk model work?</summary>
            <div className="faq-content">
              <p>
                The model processes TVL depth, DEX volume utilization, APY deviation from the 30-day mean, organic yield vs incentives, underlying asset volatility, and Nansen Smart Money flows. Each factor has strict deterministic scoring bands. You can verify the full math in our public specifications.
              </p>
            </div>
          </details>

          <details className="faq-item">
            <summary className="faq-summary">Why is Mantle Network used?</summary>
            <div className="faq-content">
              <p>
                Mantle provides sub-second transaction validation and extremely low execution costs, making continuous yield scanning and on-chain decision anchoring highly practical. Our smart contract registry anchors proofs directly to Mantle Sepolia.
              </p>
            </div>
          </details>
        </div>
      </section>

      {/* 7. BOTTOM CTA SECTION */}
      <section className="home-section glass-card-premium" style={{ textAlign: 'center', padding: '3rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', marginTop: '1rem' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--color-lime)', textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 600 }}>Verify & Audits</div>
        <h2 style={{ fontSize: '1.65rem', margin: 0, fontWeight: 700 }}>Ready to inspect the audit trails?</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 0.75rem', lineHeight: 1.6 }}>
          All NeuralRate decisions are backed by cryptographic receipts synced with Mantle. Explore live evidence or read our technical manuals.
        </p>
        <div className="hero-actions" style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn-premium hero-btn" onClick={() => onNavigate('/verify')} style={{ padding: '0.75rem 1.5rem', fontSize: '0.82rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <span>Verify Evidence Ledger</span>
          </button>
          <button className="btn-premium hero-btn" onClick={() => onNavigate('/docs')} style={{ padding: '0.75rem 1.5rem', fontSize: '0.82rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>Read Specifications</span>
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="home-footer-brand" style={{ width: '100%', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '3rem', marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '2rem', textAlign: 'left' }} className="footer-sitemap-grid">
          {/* Brand Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <div style={{
                width: '28px',
                height: '28px',
                backgroundImage: 'url(/logo.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderRadius: '6px',
                boxShadow: '0 0 8px var(--color-lime-glow)'
              }} />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>NeuralRate</h3>
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Yield Operator Terminal and non-custodial automation guardrails powered by Safe smart accounts on Mantle.
            </p>
            <div className="hero-status-tag" style={{ margin: 0, padding: '0.2rem 0.6rem', fontSize: '0.65rem', alignSelf: 'flex-start' }}>
              <span className="pulse-dot"></span>
              <span>Sepolia Active</span>
            </div>
          </div>

          {/* Column 2: Platform Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-lime)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Platform</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.78rem' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('/app'); }} style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}>Operator Terminal</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('/verify'); }} style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}>Verify Proof Ledger</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('/docs'); }} style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}>Documentation Hub</a>
            </div>
          </div>

          {/* Column 3: Trust & Security Docs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-lime)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Trust & Safety</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.78rem' }}>
              <a href="/docs/trust-assumptions.md" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}>Trust Assumptions</a>
              <a href="/docs/risk-model.md" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}>6-Factor Risk Model</a>
              <a href="/docs/mcp-server.md" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}>WebMCP Protocol Spec</a>
              <a href="/docs/architecture.md" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}>System Architecture</a>
            </div>
          </div>

          {/* Column 4: Technical Specs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-lime)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Technical Specs</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.78rem' }}>
              <a href="/docs/smart-contract.md" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}>Smart Contract Registry</a>
              <a href="/docs/database.md" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}>D1 Schema & Storage</a>
              <a href="/docs/frontend.md" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}>SPA Client Specs</a>
              <a href="/docs/deployment.md" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}>Deployment Manual</a>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.04)', paddingTop: '1.5rem', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          <span>© {new Date().getFullYear()} NeuralRate. All rights verified on-chain.</span>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <a href="/docs/README.md" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Quick Start</a>
            <span>•</span>
            <a href="https://github.com" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Open Source</a>
          </div>
        </div>
      </footer>

      <McpConnectModal isOpen={isMcpModalOpen} onClose={() => setIsMcpModalOpen(false)} />
    </div>
  );
};

export default HomePanel;
