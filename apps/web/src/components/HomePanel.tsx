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


  return (
    <div className="home-panel-wrapper animate-enter">
      {/* Background decoration orbs */}
      <div className="glow-orb-indigo"></div>
      <div className="glow-orb-lime"></div>

      {/* 1. HERO SECTION */}
      <section className="home-hero">
        <div className="hero-status-tag">
          <span className="pulse-dot"></span>
          <span>Mantle Sepolia Network Active</span>
        </div>
        <h1 className="hero-headline text-gradient">
          Intelligence Layer for<br />Autonomous AI Agents.
        </h1>
        <p className="hero-subhead">
          NeuralRate empowers AI agents and yield operators with mathematical rigor. Scan web3 opportunities, simulate deterministic risk parameters, and automate secure strategies through non-custodial Safe vaults natively via MCP.
        </p>

        <div className="hero-actions">
          <button className="btn-premium btn-premium-wallet hero-btn" onClick={() => onNavigate('/app')}>
            <span>Launch Operator Terminal</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="btn-arrow" style={{ marginLeft: '0.35rem' }}>
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>

          <button 
            className="btn-premium btn-premium-agent hero-btn" 
            onClick={() => setIsMcpModalOpen(true)}
            title="Connect AI Agent to MCP"
          >
            <span className="agent-dot"></span>
            <span>AGENT ACCESS</span>
          </button>
        </div>
      </section>

      {/* 2. DYNAMIC RISK SIMULATOR */}
      <section className="home-section glass-card-premium" id="poc-simulator">
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
                  style={{ width: '100%', padding: '0.45rem' }}
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
                    style={{ width: '100%', padding: '0.45rem' }}
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                {/* Circular conic progress ring */}
                <div style={{
                  position: 'relative',
                  width: '110px',
                  height: '110px',
                  borderRadius: '50%',
                  background: `conic-gradient(${getRatingBadgeColor(scoreBreakdown.classification)} ${scoreBreakdown.total}%, var(--bg-deep) ${scoreBreakdown.total}%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                  transition: 'background 0.3s ease'
                }}>
                  <div style={{
                    width: '94px',
                    height: '94px',
                    borderRadius: '50%',
                    background: 'var(--bg-surface-elevated)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span className="rating-grade-text" style={{ fontSize: '2.5rem', fontWeight: 800 }}>
                      {getRatingLetter(scoreBreakdown.total)}
                    </span>
                  </div>
                </div>

                <div className="rating-display-core">
                  <div className="rating-score-trail">
                    <span className="score-main">{scoreBreakdown.total.toFixed(0)}</span>
                    <span className="score-max">/100</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Safety Multiplier</span>
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

            {/* Breakdown Mini-List with micro progress bars */}
            <div className="score-mini-breakdown">
              <div className="breakdown-title">Scoring Factor Breakdown</div>
              <div className="breakdown-list">
                {/* factor 1 */}
                <div className="breakdown-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span>TVL Depth & Liquidity</span>
                    <strong>{scoreBreakdown.tvlScore} / 20</strong>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'var(--bg-deep)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: `${(scoreBreakdown.tvlScore / 20) * 100}%`, height: '100%', background: 'var(--color-lime)', borderRadius: '99px', opacity: 0.8 }} />
                  </div>
                </div>

                {/* factor 2 */}
                <div className="breakdown-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span>Vol/TVL Utilization</span>
                    <strong>{scoreBreakdown.volScore} / 15</strong>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'var(--bg-deep)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: `${(scoreBreakdown.volScore / 15) * 100}%`, height: '100%', background: 'var(--color-lime)', borderRadius: '99px', opacity: 0.8 }} />
                  </div>
                </div>

                {/* factor 3 */}
                <div className="breakdown-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span>APY Sustainability</span>
                    <strong>{scoreBreakdown.apyScore} / 20</strong>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'var(--bg-deep)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: `${(scoreBreakdown.apyScore / 20) * 100}%`, height: '100%', background: 'var(--color-lime)', borderRadius: '99px', opacity: 0.8 }} />
                  </div>
                </div>

                {/* factor 4 */}
                <div className="breakdown-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span>Yield Composition</span>
                    <strong>{scoreBreakdown.compScore} / 15</strong>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'var(--bg-deep)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: `${(scoreBreakdown.compScore / 15) * 100}%`, height: '100%', background: 'var(--color-lime)', borderRadius: '99px', opacity: 0.8 }} />
                  </div>
                </div>

                {/* factor 5 */}
                <div className="breakdown-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span>Asset Exposure & IL</span>
                    <strong>{scoreBreakdown.assetScore} / 15</strong>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'var(--bg-deep)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: `${(scoreBreakdown.assetScore / 15) * 100}%`, height: '100%', background: 'var(--color-lime)', borderRadius: '99px', opacity: 0.8 }} />
                  </div>
                </div>

                {/* factor 6 */}
                <div className="breakdown-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span>Institutional Flow</span>
                    <strong>{scoreBreakdown.flowScore} / 15</strong>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'var(--bg-deep)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: `${(scoreBreakdown.flowScore / 15) * 100}%`, height: '100%', background: 'var(--color-lime)', borderRadius: '99px', opacity: 0.8 }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. BENTO GRID SECTION */}
      <section className="home-section" id="features">
        <div className="section-header-compact" style={{ textAlign: 'center', margin: '0 auto 2.5rem' }}>
          <div className="section-kicker">Core Architecture</div>
          <h2 className="section-title">Engineered For Autonomous Safety</h2>
          <p className="section-desc" style={{ maxWidth: '600px', margin: '0 auto' }}>
            A complete ecosystem built to bridge advanced AI models with cryptographically secure on-chain operations.
          </p>
        </div>

        <div className="features-bento-grid">
          {/* Card 1: MCP Yield Automation (span 8) */}
          <div className="bento-card bento-col-8 active">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ flex: 1, minWidth: '250px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="feature-icon-wrapper">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="2">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                  </svg>
                </div>
                <h3>MCP-Native Yield Automation</h3>
                <p>
                  NeuralRate leverages standard WebMCP toolkits to empower AI agents to autonomously scan yield rates, execute Safe multi-sig signatures, and deploy programmatic vaults entirely via the Model Context Protocol.
                </p>
              </div>

              {/* Code mock representation */}
              <div style={{ flex: '0 0 240px' }} className="desktop-actions-only">
                <div className="bento-code-snippet">
                  <span className="bento-code-keyword">"tool"</span>: <span className="bento-code-string">"optimize_yield"</span>,<br />
                  <span className="bento-code-keyword">"params"</span>: &#123;<br />
                  &nbsp;&nbsp;<span className="bento-code-keyword">"vault"</span>: <span className="bento-code-string">"0x94...1a"</span>,<br />
                  &nbsp;&nbsp;<span className="bento-code-keyword">"score"</span>: <span className="bento-code-number">88.5</span>,<br />
                  &nbsp;&nbsp;<span className="bento-code-keyword">"limit"</span>: <span className="bento-code-string">"100%"</span><br />
                  &#125;
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Multi-Agent Connectivity (span 4) */}
          <div className="bento-card bento-col-4">
            <div className="feature-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <h3>Multi-Agent Connect</h3>
            <p>
              Plug your existing agent frameworks (LangChain, AutoGPT, Eliza) directly into NeuralRate. Grant restricted programmatic access with cryptographic guardrails.
            </p>
          </div>

          {/* Card 3: Deterministic Risk Modeling (span 4) */}
          <div className="bento-card bento-col-4">
            <div className="feature-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
                <line x1="15" y1="3" x2="15" y2="21"></line>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="3" y1="15" x2="21" y2="15"></line>
              </svg>
            </div>
            <h3>Deterministic Modeling</h3>
            <p>
              Zero opinions. Zero black boxes. Our 6-factor mathematical model translates complex on-chain parameters into a unified, mathematically verifiable safety score.
            </p>
          </div>

          {/* Card 4: Non-Custodial Safe Vaults (span 4) */}
          <div className="bento-card bento-col-4">
            <div className="feature-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h3>Safe Smart Accounts</h3>
            <p>
              Your funds never leave your Safe. Automated strategies execute within signed cryptographic limits, hard-blocked by on-chain policies and multisig bounds.
            </p>
          </div>

          {/* Card 5: Mantle Yield Optimization (span 4) */}
          <div className="bento-card bento-col-4">
            <div className="feature-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
            </div>
            <h3>Mantle Yield Optimization</h3>
            <p>
              Engineered on Mantle Network for ultra-low costs, sub-second execution speeds, and gas-efficient continuous scanning for continuous automated execution.
            </p>
          </div>

          {/* Card 6: Immutable Verification Ledger (span 12) */}
          <div className="bento-card bento-col-12">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="feature-icon-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <h3>Immutable Proof & Verification Ledger</h3>
              <p>
                Every single advisory decision and automated allocation triggers a cryptographic receipt anchored directly to the Mantle blockchain. The public registry stores hashes of inputs and scoring factors, creating an audit trail that is publicly verifiable forever. No manual database entries, pure cryptographic truth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. VISUAL TIMELINE: DECISION LINEAGE */}
      <section className="home-section glass-card-premium" id="how-it-works">
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
              <h4>Yield Scan & Assembly</h4>
              <p>
                DEX pools and lending rates are scraped. Key metrics (TVL, stable ratio, average daily volume) are locked in a deterministic envelope.
              </p>
            </div>
          </div>

          <div className="timeline-node">
            <div className="node-marker">2</div>
            <div className="node-content">
              <h4>Scoring Engine</h4>
              <p>
                Metrics are parsed through our open-source 6-factor scoring spec. An immutable recommendation rationale is generated with exact inputs.
              </p>
            </div>
          </div>

          <div className="timeline-node">
            <div className="node-marker">3</div>
            <div className="node-content">
              <h4>Attestation Receipt</h4>
              <p>
                The advisor generates a unique decision hash. This hash binds the input metrics, risk calculations, and resulting action plan together.
              </p>
            </div>
          </div>

          <div className="timeline-node">
            <div className="node-marker">4</div>
            <div className="node-content">
              <h4>On-Chain Anchoring</h4>
              <p>
                The transaction is pushed to the Mantle Sepolia network. The `DecisionReceiptRegistry` anchors the hash, creating a permanently verifiable audit trail.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. TECH INTEGRATIONS & TRUST METRICS BAR */}
      <section className="home-section" style={{ textAlign: 'center' }}>
        <div className="section-header-compact" style={{ margin: '0 auto 1.5rem' }}>
          <div className="section-kicker">Built on standard web3 infrastructure</div>
          <h2 className="section-title" style={{ fontSize: '1.45rem', color: 'var(--text-secondary)' }}>Powering the NeuralRate Stack</h2>
        </div>

        <div className="integrations-grid">
          <div className="integration-badge">
            <span className="badge-logo">Mantle</span>
            <span>Mantle Network</span>
          </div>
          <div className="integration-badge">
            <span className="badge-logo">Safe</span>
            <span>Safe Contracts</span>
          </div>
          <div className="integration-badge">
            <span className="badge-logo">Privy</span>
            <span>Privy Auth</span>
          </div>
          <div className="integration-badge">
            <span className="badge-logo">WebMCP</span>
            <span>Agent Web Tools</span>
          </div>
        </div>

        {/* 3-column key metrics */}
        <div className="trust-metrics-bar">
          <div className="trust-metric-item">
            <span className="trust-metric-number">0%</span>
            <span className="trust-metric-label">Custodial Risk</span>
            <p className="trust-metric-desc">Funds stay in your Safe smart account, hard-blocked by programmatic policies.</p>
          </div>
          <div className="trust-metric-item">
            <span className="trust-metric-number">100%</span>
            <span className="trust-metric-label">Verifiable Proofs</span>
            <p className="trust-metric-desc">Every single allocation decision is anchored directly on the Mantle blockchain.</p>
          </div>
          <div className="trust-metric-item">
            <span className="trust-metric-number">Open</span>
            <span className="trust-metric-label">Mathematical Specs</span>
            <p className="trust-metric-desc">Inspect and verify our 6-factor mathematical risk calculations in public specifications.</p>
          </div>
        </div>
      </section>

      {/* 6. SEMANTIC FAQ ACCORDIONS */}
      <section className="home-section" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="section-header-compact" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
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

          <details className="faq-item">
            <summary className="faq-summary">How do I connect NeuralRate to my AI Agent?</summary>
            <div className="faq-content">
              <p>
                You can expose NeuralRate functions to your AI agent by starting the NeuralRate MCP Server. Using our WebMCP protocol, your agent can query real-time yield opportunities, inspect pool risks, and trigger safe automated deposits with strict cryptographical permissions.
              </p>
            </div>
          </details>
        </div>
      </section>

      {/* 7. BOTTOM CTA SECTION */}
      <section className="home-section glass-card-premium" style={{ textAlign: 'center', padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', marginTop: '1rem' }}>
        <div className="section-kicker">Verify & Audits</div>
        <h2 style={{ fontSize: '2rem', margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>Ready to inspect the audit trails?</h2>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 0.75rem', lineHeight: 1.6 }}>
          All NeuralRate decisions are backed by cryptographic receipts synced with Mantle. Explore live evidence or read our technical manuals.
        </p>
        <div className="hero-actions">
          <button className="btn-premium hero-btn" onClick={() => onNavigate('/verify')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '0.35rem' }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <span>Verify Evidence Ledger</span>
          </button>
          <button className="btn-premium hero-btn" onClick={() => onNavigate('/docs')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '0.35rem' }}>
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
      <footer className="home-footer-brand">
        <div className="footer-sitemap-grid">
          {/* Brand Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <div style={{
                width: '28px',
                height: '28px',
                backgroundImage: 'url(/logo.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderRadius: '6px',
                boxShadow: '0 0 8px rgba(223, 246, 81, 0.15)'
              }} />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>NeuralRate</h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Yield Operator Terminal and non-custodial automation guardrails powered by Safe smart accounts on Mantle.
            </p>
            <div className="hero-status-tag" style={{ margin: '0.5rem 0 0 0', padding: '0.25rem 0.75rem', fontSize: '0.65rem', alignSelf: 'flex-start' }}>
              <span className="pulse-dot"></span>
              <span>Sepolia Active</span>
            </div>
          </div>

          {/* Column 2: Platform Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <h4>Platform</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('/app'); }}>Operator Terminal</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('/verify'); }}>Verify Proof Ledger</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('/docs'); }}>Documentation Hub</a>
            </div>
          </div>

          {/* Column 3: Trust & Security Docs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <h4>Trust & Safety</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <a href="/docs/trust-assumptions.md" target="_blank" rel="noreferrer">Trust Assumptions</a>
              <a href="/docs/risk-model.md" target="_blank" rel="noreferrer">6-Factor Risk Model</a>
              <a href="/docs/mcp-server.md" target="_blank" rel="noreferrer">WebMCP Protocol Spec</a>
              <a href="/docs/architecture.md" target="_blank" rel="noreferrer">System Architecture</a>
            </div>
          </div>

          {/* Column 4: Technical Specs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <h4>Technical Specs</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <a href="/docs/smart-contract.md" target="_blank" rel="noreferrer">Smart Contract Registry</a>
              <a href="/docs/database.md" target="_blank" rel="noreferrer">D1 Schema & Storage</a>
              <a href="/docs/frontend.md" target="_blank" rel="noreferrer">SPA Client Specs</a>
              <a href="/docs/deployment.md" target="_blank" rel="noreferrer">Deployment Manual</a>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid oklch(100% 0 0 / 0.04)', paddingTop: '2rem', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span>© {new Date().getFullYear()} NeuralRate. All rights verified on-chain.</span>
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
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
