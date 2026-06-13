import React, { useState, useMemo, useEffect, useRef } from 'react';
import McpConnectModal from './McpConnectModal';
import ParticleCanvas from './ParticleCanvas';
import CountUp from './CountUp';
import SpiderChart from './SpiderChart';

import { type McpAccessBundle } from '../lib/mcpAccess';

interface HomePanelProps {
  onNavigate: (path: string) => void;
  mcpAccessBundle?: McpAccessBundle | null;
}

const HomePanel: React.FC<HomePanelProps> = ({ onNavigate, mcpAccessBundle }) => {
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

  // Custom Select Dropdowns State
  const [volDropdownOpen, setVolDropdownOpen] = useState<boolean>(false);
  const [ilDropdownOpen, setIlDropdownOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleOutsideClick = () => {
      setVolDropdownOpen(false);
      setIlDropdownOpen(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Interactive Bento Code State
  const [activeCodeTab, setActiveCodeTab] = useState<'mcp' | 'proof'>('mcp');
  const [mcpConsoleLines, setMcpConsoleLines] = useState<string[]>([
    'Connecting to the NeuralRate MCP server...',
    '✓ Public read-only catalog available over Streamable HTTP.',
  ]);
  const [isMcpRunning, setIsMcpRunning] = useState<boolean>(false);

  // Interactive Protocol Tab Selector
  const [activeProtocolTab, setActiveProtocolTab] = useState<'pipeline' | 'ledger' | 'sandbox'>('pipeline');

  // Interactive FAQ Terminal States
  const [activeFaqIndex, setActiveFaqIndex] = useState<number>(0);
  const [isFaqScanning, setIsFaqScanning] = useState<boolean>(false);
  const [faqScanResult, setFaqScanResult] = useState<string>('');

  const triggerFaqScan = () => {
    setIsFaqScanning(true);
    setFaqScanResult('CALLING PUBLIC MCP TOOL: risk_assess...');
    setTimeout(() => {
      setFaqScanResult('EVALUATING THE 6-FACTOR INPUT SNAPSHOT...');
      setTimeout(() => {
        setFaqScanResult('✓ RESULT: SCORE 92.4 / CLASSIFICATION LOW');
        setIsFaqScanning(false);
      }, 500);
    }, 500);
  };

  // Hero Terminal Live Simulation State
  const [terminalLines, setTerminalLines] = useState<{ type: 'cmd' | 'info' | 'success' | 'res'; text: string }[]>([]);
  const terminalStepRef = useRef<number>(0);
  const terminalBodyRef = useRef<HTMLDivElement>(null);
  const terminalResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Simulator calculation logic
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
    let sustainSub = 10;
    if (apy > 10) {
      sustainSub = Math.max(2, 10 - ((apy - 10) / 40) * 8);
    }
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

  // Easing & styling colors
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

  // Slider background ratios
  const tvlPercent = ((tvl - 50000) / (150000000 - 50000)) * 100;
  const volPercent = (volumeRatio / 150) * 100;
  const apyPercent = ((apy - 1) / 59) * 100;
  const organicPercent = organicRatio;
  const netFlowPercent = ((netFlow + 250000) / 1000000) * 100;

  useEffect(() => {
    const terminalBody = terminalBodyRef.current;
    if (!terminalBody) return;

    const animationFrame = window.requestAnimationFrame(() => {
      terminalBody.scrollTo({
        top: terminalLines.length > 0 ? terminalBody.scrollHeight : 0,
        behavior: terminalLines.length > 0 ? 'smooth' : 'auto',
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [terminalLines]);

  // Hero Terminal Simulation Effect
  useEffect(() => {
    const scripts = [
      { type: 'cmd', text: 'mcp.connect https://neuralrate-worker.neuralrate.workers.dev/mcp' },
      { type: 'success', text: '  ✓ Public catalog connected: 5 read-only tools.' },
      { type: 'cmd', text: 'tools/call risk_assess' },
      { type: 'res', text: '  { "score": 92.4, "classification": "LOW", "deterministic": true }' },
      { type: 'cmd', text: 'mcp.connect /mcp/scoped/execution' },
      { type: 'info', text: '  ↳ Owner-issued session token and execution domain required.' },
      { type: 'cmd', text: 'tools/call open_position' },
      { type: 'info', text: '  ↳ Checking vault, grant, runtime, asset, amount, and on-chain policy...' },
      { type: 'success', text: '  ✓ Request accepted inside the owner-approved scope.' },
      { type: 'success', text: '  ✓ Safe execution proof recorded on Mantle Sepolia.' },
    ];

    const timer = setInterval(() => {
      const next = terminalStepRef.current + 1;
      if (next > scripts.length) {
        if (!terminalResetTimeoutRef.current) {
          terminalResetTimeoutRef.current = setTimeout(() => {
            setTerminalLines([]);
            terminalStepRef.current = 0;
            terminalResetTimeoutRef.current = null;
          }, 3000);
        }
        return;
      }
      setTerminalLines((lines) => [...lines, scripts[next - 1] as any]);
      terminalStepRef.current = next;
    }, 1800);

    return () => {
      clearInterval(timer);
      if (terminalResetTimeoutRef.current) {
        clearTimeout(terminalResetTimeoutRef.current);
        terminalResetTimeoutRef.current = null;
      }
    };
  }, []);

  // MCP sandbox code runner simulation
  const runMcpSandbox = () => {
    if (isMcpRunning) return;
    setIsMcpRunning(true);
    setMcpConsoleLines((prev) => [...prev, '▸ tools/call risk_assess { pool: "LEND-MNT" }']);
    
    setTimeout(() => {
      setMcpConsoleLines((prev) => [
        ...prev,
        '  ↳ public MCP catalog: read-only',
        '  ↳ deterministic inputs accepted',
        '  ↳ no vault authority requested',
      ]);
    }, 1000);

    setTimeout(() => {
      setMcpConsoleLines((prev) => [
        ...prev,
        '  { "success": true, "score": 76.5, "classification": "MEDIUM" }',
        '✓ Advisory result returned. No transaction was created.',
      ]);
      setIsMcpRunning(false);
    }, 2200);
  };

  const handleSmoothScroll = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <div className="particle-canvas-wrapper">
        <ParticleCanvas />
      </div>

      {/* Background decoration orbs */}
      <div className="glow-orb-indigo" style={{ filter: 'blur(150px)', opacity: 0.09 }}></div>
      <div className="glow-orb-lime" style={{ filter: 'blur(150px)', opacity: 0.05 }}></div>

      <div className="home-panel-wrapper animate-enter" style={{ overflowX: 'hidden' }}>

      {/* ═══════════════════════════════════════════
          1. HERO SECTION — brand header + Terminal
          ═══════════════════════════════════════════ */}
      <section className="home-hero" id="hero-section" style={{ minHeight: '95vh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '1rem' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 10, marginBottom: '1rem', alignSelf: 'center' }}>
          <img 
            src="/logo.png" 
            alt="NeuralRate Logo" 
            style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '10px', 
              boxShadow: '0 0 20px rgba(223, 246, 81, 0.2)',
              border: '1px solid rgba(223, 246, 81, 0.12)'
            }} 
          />
          <span style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.8px', fontFamily: 'var(--font-main)' }}>
            NeuralRate
          </span>
        </div>

        <h1 className="hero-headline hero-headline-gradient" style={{ zIndex: 10, fontSize: '3.75rem', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.15, marginTop: '0.5rem', marginBottom: '0.1rem', textTransform: 'none' }}>
          The MCP Safety Layer
        </h1>
        <div className="hero-headline-sub" style={{ zIndex: 10, fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          <span>for</span>
          <span className="word-cycle-container">
            <span className="word-cycle-track">
              <span className="word-cycle-item">External AI Models</span>
              <span className="word-cycle-item">Agent Frameworks</span>
              <span className="word-cycle-item">Owner-Controlled Vaults</span>
              <span className="word-cycle-item">On-Chain Policy Enforcement</span>
            </span>
          </span>
        </div>

        <p className="hero-subhead" style={{ zIndex: 10, maxWidth: '640px', margin: '3rem auto 3rem', color: 'var(--text-secondary)', fontSize: '0.96rem', lineHeight: 1.5 }}>
          Connect any external AI model through MCP. The owner defines the vault, permissions, limits, and expiry. NeuralRate exposes only the authorized tools and enforces execution policy on-chain.
        </p>


        {/* Hero Terminal with conic border gradient & floating animations */}
        <div className="hero-terminal-premium" style={{ zIndex: 10 }}>
          <div className="terminal-header" style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid oklch(100% 0 0 / 0.06)', background: 'oklch(12% 0.01 240 / 0.8)' }}>
            <div style={{ display: 'flex', gap: '0.45rem' }}>
              <div className="terminal-dot red" style={{ width: '10px', height: '10px' }}></div>
              <div className="terminal-dot yellow" style={{ width: '10px', height: '10px' }}></div>
              <div className="terminal-dot green" style={{ width: '10px', height: '10px' }}></div>
            </div>
            <span className="terminal-title" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>neuralrate_mcp_session - owner_scope_#092b</span>
            <a href="#poc-simulator" onClick={(e) => handleSmoothScroll(e, 'poc-simulator')} style={{ color: 'var(--color-lime)', fontSize: '0.72rem', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span>▸ Simulate</span>
            </a>
          </div>
          <div ref={terminalBodyRef} className="terminal-body" style={{ padding: '1.25rem 1.5rem', height: '210px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '0.4rem', overflowY: 'hidden', scrollBehavior: 'smooth', textAlign: 'left', fontSize: '0.75rem', lineHeight: 1.55 }}>
            {terminalLines.map((line, idx) => (
              <div key={idx} className={`terminal-line ${line.type === 'success' ? 'terminal-success' : ''}`}>
                {line.type === 'cmd' && <span className="terminal-prompt" style={{ color: 'var(--color-lime)' }}>▸ </span>}
                {line.type === 'cmd' && <span className="terminal-cmd" style={{ color: '#fff', fontWeight: 600 }}>{line.text.split(' ')[0]}</span>}
                {line.type === 'cmd' && <span className="terminal-comment" style={{ color: 'var(--text-secondary)' }}>{line.text.substring(line.text.indexOf(' '))}</span>}
                
                {line.type === 'info' && <span className="terminal-comment" style={{ color: 'var(--text-muted)' }}>{line.text}</span>}
                
                {line.type === 'success' && <span style={{ color: 'var(--color-success)' }}>{line.text}</span>}
                
                {line.type === 'res' && <span style={{ color: '#9d9eff', fontFamily: 'var(--font-mono)' }}>{line.text}</span>}
              </div>
            ))}
            <div className="terminal-line">
              <span className="terminal-cursor"></span>
            </div>
          </div>
        </div>

        {/* Stats Counter Bar — counts up dynamically when viewport intersects */}
        <div style={{ zIndex: 10, width: '100%', maxWidth: '720px', margin: '0 auto' }}>
          <div className="stats-counter-bar">
            <div className="stat-item">
              <span className="stat-value">
                <CountUp end={5} suffix="" />
              </span>
              <span className="stat-label">Public MCP Tools</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">
                <CountUp end={4} suffix="" />
              </span>
              <span className="stat-label">Scoped Catalogs</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">OWNER</span>
              <span className="stat-label">Defines Every Limit</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">ON-CHAIN</span>
              <span className="stat-label">Execution Policy</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          2. INTERACTIVE RISK SIMULATOR — Visual Ring + Custom Sliders + Radar Chart (Primary Centerpiece)
          ═══════════════════════════════════════════ */}
      <section className="home-section" id="poc-simulator" style={{ paddingTop: '8rem', paddingBottom: '6rem' }}>
        <div className="section-header-compact" style={{ textAlign: 'center', margin: '0 auto 3rem' }}>
          <div className="section-kicker">Public MCP advisory tool</div>
          <h2 className="section-title" style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Deterministic Risk Assessment</h2>
          <p className="section-desc" style={{ maxWidth: '600px', margin: '0.75rem auto 0' }}>
            Explore the same deterministic 6-factor model exposed to external AI clients through the public read-only MCP catalog.
          </p>
        </div>

        <div className="simulator-shell animated-border-card" style={{ maxWidth: '980px', margin: '0 auto' }}>
          <div className="simulator-shell-header" style={{ padding: '0.85rem 1.25rem', background: 'oklch(12% 0.01 240 / 0.8)', borderBottom: '1px solid oklch(100% 0 0 / 0.06)' }}>
            <div style={{ display: 'flex', gap: '0.45rem' }}>
              <div className="terminal-dot red" style={{ width: '10px', height: '10px' }}></div>
              <div className="terminal-dot yellow" style={{ width: '10px', height: '10px' }}></div>
              <div className="terminal-dot green" style={{ width: '10px', height: '10px' }}></div>
            </div>
            <span className="simulator-shell-title" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>risk_simulation_sandbox.nr</span>
          </div>

          <div className="simulator-shell-body" style={{ padding: '2rem' }}>
            <div className="simulator-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2.5rem' }}>
              
              {/* Sliders Panel */}
              <div className="simulator-controls" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
                
                {/* 1. TVL Slider */}
                <div className="control-group">
                  <div className="control-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    <label style={{ fontWeight: 700, color: 'var(--text-primary)' }}>1. Protocol TVL Depth</label>
                    <span className="control-value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-lime)' }}>
                      ${(tvl / 1000000).toFixed(1)}M
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="50000" 
                    max="150000000" 
                    step="500000" 
                    value={tvl} 
                    onChange={(e) => setTvl(Number(e.target.value))} 
                    className="simulator-slider-premium" 
                    style={{ '--fill-percent': `${tvlPercent}%` } as React.CSSProperties}
                  />
                  <span className="control-caption" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    Deeper capital pools minimize localized exit slippage spikes.
                  </span>
                </div>

                {/* 2. Volume Utilization Slider */}
                <div className="control-group">
                  <div className="control-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    <label style={{ fontWeight: 700, color: 'var(--text-primary)' }}>2. Vol / TVL Ratio (24h)</label>
                    <span className="control-value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-lime)' }}>
                      {volumeRatio.toFixed(0)}%
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="150" 
                    step="1" 
                    value={volumeRatio} 
                    onChange={(e) => setVolumeRatio(Number(e.target.value))} 
                    className="simulator-slider-premium" 
                    style={{ '--fill-percent': `${volPercent}%` } as React.CSSProperties}
                  />
                  <span className="control-caption" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    Healthy volume validates protocol depth; spikes above 100% flag wash trading.
                  </span>
                </div>

                {/* 3. APY & Volatility */}
                <div className="control-group-split" style={{ display: 'flex', gap: '1rem' }}>
                  <div className="control-group" style={{ flex: 1 }}>
                    <div className="control-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                      <label style={{ fontWeight: 700, color: 'var(--text-primary)' }}>3. Protocol APY</label>
                      <span className="control-value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-lime)' }}>
                        {apy.toFixed(1)}%
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="60" 
                      step="0.5" 
                      value={apy} 
                      onChange={(e) => setApy(Number(e.target.value))} 
                      className="simulator-slider-premium" 
                      style={{ '--fill-percent': `${apyPercent}%` } as React.CSSProperties}
                    />
                  </div>
                  <div className="control-group" style={{ width: '120px' }}>
                    <div className="control-header" style={{ marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                      <label style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Asset Vol</label>
                    </div>
                    <div className="custom-select-container" style={{ position: 'relative', width: '100%' }}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setVolDropdownOpen(!volDropdownOpen);
                          setIlDropdownOpen(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '0.45rem 0.65rem',
                          borderRadius: '8px',
                          background: 'var(--bg-surface-elevated)',
                          border: '1px solid oklch(100% 0 0 / 0.08)',
                          color: '#fff',
                          fontSize: '0.8rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-mono)',
                          textTransform: 'uppercase',
                          outline: 'none',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(223, 246, 81, 0.25)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'oklch(100% 0 0 / 0.08)'}
                      >
                        <span style={{ fontWeight: 600 }}>{volatility}</span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--color-lime)', transform: volDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
                      </button>
                      {volDropdownOpen && (
                        <div 
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            width: '100%',
                            marginTop: '4px',
                            background: 'oklch(16% 0.012 240 / 0.95)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid oklch(100% 0 0 / 0.12)',
                            borderRadius: '8px',
                            zIndex: 50,
                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                            overflow: 'hidden',
                          }}
                        >
                          {(['low', 'medium', 'high'] as const).map((val) => (
                            <button
                              key={val}
                              onClick={() => {
                                setVolatility(val);
                                setVolDropdownOpen(false);
                              }}
                              style={{
                                width: '100%',
                                padding: '0.45rem 0.65rem',
                                border: 'none',
                                background: volatility === val ? 'rgba(223, 246, 81, 0.1)' : 'transparent',
                                color: volatility === val ? 'var(--color-lime)' : 'var(--text-secondary)',
                                fontSize: '0.75rem',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-mono)',
                                textTransform: 'uppercase',
                                display: 'block',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                if (volatility !== val) e.currentTarget.style.color = '#fff';
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                              }}
                              onMouseLeave={(e) => {
                                if (volatility !== val) e.currentTarget.style.color = 'var(--text-secondary)';
                                e.currentTarget.style.background = volatility === val ? 'rgba(223, 246, 81, 0.1)' : 'transparent';
                              }}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. Organic Ratio */}
                <div className="control-group">
                  <div className="control-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    <label style={{ fontWeight: 700, color: 'var(--text-primary)' }}>4. Organic Fee Ratio</label>
                    <span className="control-value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-lime)' }}>
                      {organicRatio}%
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5" 
                    value={organicRatio} 
                    onChange={(e) => setOrganicRatio(Number(e.target.value))} 
                    className="simulator-slider-premium" 
                    style={{ '--fill-percent': `${organicPercent}%` } as React.CSSProperties}
                  />
                  <span className="control-caption" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    Checks borrow/swap utility fees versus artificial token emission handouts.
                  </span>
                </div>

                {/* 5. Asset Class Selector */}
                <div className="control-group-split" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div className="control-group" style={{ flex: 1 }}>
                    <div className="control-header" style={{ marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                      <label style={{ fontWeight: 700, color: 'var(--text-primary)' }}>5. Underlying Asset Risk</label>
                    </div>
                    <div className="radio-toggle-group" style={{ display: 'flex', background: 'oklch(100% 0 0 / 0.03)', padding: '3px', borderRadius: '10px', border: '1px solid oklch(100% 0 0 / 0.05)' }}>
                      <button 
                        className={`radio-toggle-btn ${isStablecoin ? 'active' : ''}`} 
                        onClick={() => { setIsStablecoin(true); setIlRisk('no'); }}
                        style={{ flex: 1, padding: '0.45rem', border: 'none', borderRadius: '7px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', background: isStablecoin ? 'var(--color-lime)' : 'transparent', color: isStablecoin ? 'var(--bg-deep)' : 'var(--text-secondary)' }}
                      >
                        Stablecoin
                      </button>
                      <button 
                        className={`radio-toggle-btn ${!isStablecoin ? 'active' : ''}`} 
                        onClick={() => setIsStablecoin(false)}
                        style={{ flex: 1, padding: '0.45rem', border: 'none', borderRadius: '7px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', background: !isStablecoin ? 'var(--color-lime)' : 'transparent', color: !isStablecoin ? 'var(--bg-deep)' : 'var(--text-secondary)' }}
                      >
                        Volatile Asset
                      </button>
                    </div>
                  </div>
                  {!isStablecoin && (
                    <div className="control-group" style={{ width: '120px' }}>
                      <div className="control-header" style={{ marginBottom: '0.35rem', fontSize: '0.85rem' }}><label style={{ fontWeight: 700 }}>IL Exposure</label></div>
                      <div className="custom-select-container" style={{ position: 'relative', width: '100%' }}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setIlDropdownOpen(!ilDropdownOpen);
                            setVolDropdownOpen(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '8px',
                            background: 'var(--bg-surface-elevated)',
                            border: '1px solid oklch(100% 0 0 / 0.08)',
                            color: '#fff',
                            fontSize: '0.8rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-mono)',
                            textTransform: 'uppercase',
                            outline: 'none',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(223, 246, 81, 0.25)'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'oklch(100% 0 0 / 0.08)'}
                        >
                          <span style={{ fontWeight: 600 }}>{ilRisk === 'yes' ? 'Yes (LP)' : 'No IL'}</span>
                          <span style={{ fontSize: '0.6rem', color: 'var(--color-lime)', transform: ilDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
                        </button>
                        {ilDropdownOpen && (
                          <div 
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              width: '100%',
                              marginTop: '4px',
                              background: 'oklch(16% 0.012 240 / 0.95)',
                              backdropFilter: 'blur(12px)',
                              border: '1px solid oklch(100% 0 0 / 0.12)',
                              borderRadius: '8px',
                              zIndex: 50,
                              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                              overflow: 'hidden',
                            }}
                          >
                            {[
                              { value: 'no', label: 'No IL' },
                              { value: 'yes', label: 'Yes (LP)' }
                            ].map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => {
                                  setIlRisk(opt.value as any);
                                  setIlDropdownOpen(false);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '0.45rem 0.65rem',
                                  border: 'none',
                                  background: ilRisk === opt.value ? 'rgba(223, 246, 81, 0.1)' : 'transparent',
                                  color: ilRisk === opt.value ? 'var(--color-lime)' : 'var(--text-secondary)',
                                  fontSize: '0.75rem',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  fontFamily: 'var(--font-mono)',
                                  textTransform: 'uppercase',
                                  display: 'block',
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  if (ilRisk !== opt.value) e.currentTarget.style.color = '#fff';
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                }}
                                onMouseLeave={(e) => {
                                  if (ilRisk !== opt.value) e.currentTarget.style.color = 'var(--text-secondary)';
                                  e.currentTarget.style.background = ilRisk === opt.value ? 'rgba(223, 246, 81, 0.1)' : 'transparent';
                                }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 6. Net Flow Slider */}
                <div className="control-group">
                  <div className="control-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    <label style={{ fontWeight: 700, color: 'var(--text-primary)' }}>6. Smart Money flows (24h)</label>
                    <span className="control-value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-lime)' }}>
                      {netFlow >= 0 ? `+$${(netFlow / 1000).toFixed(0)}k` : `-$${(Math.abs(netFlow) / 1000).toFixed(0)}k`}
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="-250000" 
                    max="750000" 
                    step="2500" 
                    value={netFlow} 
                    onChange={(e) => setNetFlow(Number(e.target.value))} 
                    className="simulator-slider-premium" 
                    style={{ '--fill-percent': `${netFlowPercent}%` } as React.CSSProperties}
                  />
                  <span className="control-caption" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    Tracks institutional capital inflows or flight vectors.
                  </span>
                </div>
              </div>

              {/* Results Panel */}
              <div className="simulator-results" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="result-metric-card" style={{ padding: '1.75rem', borderRadius: '20px', background: 'oklch(100% 0 0 / 0.015)', border: '1px solid oklch(100% 0 0 / 0.06)' }}>
                  
                  {/* Gauge section header */}
                  <div className="result-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <span className="result-label" style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                      System Verdict Rating
                    </span>
                    <span 
                      className="rating-badge" 
                      style={{ 
                        backgroundColor: getRatingBadgeColor(scoreBreakdown.classification), 
                        color: 'var(--bg-deep)', 
                        fontWeight: 800, 
                        fontSize: '0.68rem', 
                        padding: '0.25rem 0.65rem', 
                        borderRadius: '6px',
                        boxShadow: `0 0 15px ${getRatingBadgeColor(scoreBreakdown.classification)}30`
                      }}
                    >
                      {scoreBreakdown.classification} RISK
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' }}>
                    {/* SVG Circular Donut Ring */}
                    <div style={{ position: 'relative', width: '110px', height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="110" height="110" viewBox="0 0 110 110">
                        {/* Background track */}
                        <circle cx="55" cy="55" r="45" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="6" />
                        {/* Active ring */}
                        <circle 
                          cx="55" 
                          cy="55" 
                          r="45" 
                          fill="none" 
                          stroke={getRatingBadgeColor(scoreBreakdown.classification)} 
                          strokeWidth="6" 
                          strokeDasharray={2 * Math.PI * 45}
                          strokeDashoffset={2 * Math.PI * 45 - (2 * Math.PI * 45 * scoreBreakdown.total) / 100}
                          strokeLinecap="round"
                          transform="rotate(-90 55 55)"
                          style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s' }}
                        />
                      </svg>
                      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '2.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#fff', lineHeight: 1 }}>
                          {getRatingLetter(scoreBreakdown.total)}
                        </span>
                      </div>
                    </div>

                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.15rem' }}>
                        <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-lime)', fontFamily: 'var(--font-mono)' }}>
                          {scoreBreakdown.total.toFixed(0)}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>/100</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Calculated Safety Quotient</span>
                    </div>
                  </div>
                </div>

                {/* Radar/Spider Chart SVG integration */}
                <div className="spider-chart-wrapper">
                  <div style={{ width: '100%', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <SpiderChart 
                      size={220}
                      factors={[
                        { name: 'TVL Depth', score: scoreBreakdown.tvlScore, max: 20 },
                        { name: 'DEX Vol', score: scoreBreakdown.volScore, max: 15 },
                        { name: 'APY Dev', score: scoreBreakdown.apyScore, max: 20 },
                        { name: 'Fee Ratio', score: scoreBreakdown.compScore, max: 15 },
                        { name: 'IL Exposure', score: scoreBreakdown.assetScore, max: 15 },
                        { name: 'Net Flow', score: scoreBreakdown.flowScore, max: 15 },
                      ]}
                    />
                  </div>
                </div>



              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          3. THE NEURALRATE SECURITY CORE HUB — Consolidated Section (Pipeline + On-Chain Proofs + MCP Sandbox)
          ═══════════════════════════════════════════ */}
      <section className="home-section" id="how-it-works" style={{ paddingTop: '6rem', paddingBottom: '6rem', background: 'linear-gradient(180deg, transparent, rgba(99,102,241,0.01) 50%, transparent)' }}>
        <div className="section-header-compact" style={{ textAlign: 'center', margin: '0 auto 1rem' }}>
          <div className="section-kicker">Unified Trust Architecture</div>
          <h2 className="section-title" style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.03em' }}>The NeuralRate Security Protocol</h2>
          <p className="section-desc" style={{ maxWidth: '600px', margin: '0.75rem auto 0' }}>
            External models provide the reasoning. NeuralRate provides MCP tools, owner-scoped authorization, policy checks, Safe execution, and on-chain evidence.
          </p>
        </div>

        <div style={{ maxWidth: '1020px', margin: '0 auto' }}>
          <div className="responsive-timeline-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2.6fr', gap: '3rem', marginTop: '3.5rem', textAlign: 'left', width: '100%' }}>
            
            {/* Left Sidebar Controller */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderRight: '1px solid oklch(100% 0 0 / 0.05)', paddingRight: '2rem' }}>
              <button 
                onClick={() => setActiveProtocolTab('pipeline')}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '0.35rem', border: 'none', textAlign: 'left', cursor: 'pointer', padding: '1rem', borderRadius: '12px',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  background: activeProtocolTab === 'pipeline' ? 'oklch(100% 0 0 / 0.02)' : 'transparent',
                  borderLeft: activeProtocolTab === 'pipeline' ? '2px solid var(--color-lime)' : '2px solid transparent',
                  paddingLeft: activeProtocolTab === 'pipeline' ? '1rem' : '0.5rem',
                }}
              >
                <span style={{ fontSize: '0.68rem', color: activeProtocolTab === 'pipeline' ? 'var(--color-lime)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.08em' }}>PHASE 01</span>
                <h4 style={{ margin: 0, fontSize: '0.96rem', color: activeProtocolTab === 'pipeline' ? '#fff' : 'var(--text-secondary)', fontWeight: 700 }}>MCP Discovery & Advice</h4>
                <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>Read-only tools for external models and agent clients.</p>
              </button>

              <button 
                onClick={() => setActiveProtocolTab('ledger')}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '0.35rem', border: 'none', textAlign: 'left', cursor: 'pointer', padding: '1rem', borderRadius: '12px',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  background: activeProtocolTab === 'ledger' ? 'oklch(100% 0 0 / 0.02)' : 'transparent',
                  borderLeft: activeProtocolTab === 'ledger' ? '2px solid var(--color-lime)' : '2px solid transparent',
                  paddingLeft: activeProtocolTab === 'ledger' ? '1rem' : '0.5rem',
                }}
              >
                <span style={{ fontSize: '0.68rem', color: activeProtocolTab === 'ledger' ? 'var(--color-lime)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.08em' }}>PHASE 02</span>
                <h4 style={{ margin: 0, fontSize: '0.96rem', color: activeProtocolTab === 'ledger' ? '#fff' : 'var(--text-secondary)', fontWeight: 700 }}>Authorization & Evidence</h4>
                <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>Owner grants, scoped sessions, and inspectable on-chain proof.</p>
              </button>

              <button 
                onClick={() => setActiveProtocolTab('sandbox')}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '0.35rem', border: 'none', textAlign: 'left', cursor: 'pointer', padding: '1rem', borderRadius: '12px',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  background: activeProtocolTab === 'sandbox' ? 'oklch(100% 0 0 / 0.02)' : 'transparent',
                  borderLeft: activeProtocolTab === 'sandbox' ? '2px solid var(--color-lime)' : '2px solid transparent',
                  paddingLeft: activeProtocolTab === 'sandbox' ? '1rem' : '0.5rem',
                }}
              >
                <span style={{ fontSize: '0.68rem', color: activeProtocolTab === 'sandbox' ? 'var(--color-lime)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.08em' }}>PHASE 03</span>
                <h4 style={{ margin: 0, fontSize: '0.96rem', color: activeProtocolTab === 'sandbox' ? '#fff' : 'var(--text-secondary)', fontWeight: 700 }}>Policy-Gated Execution</h4>
                <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>Safe execution only inside owner-approved on-chain limits.</p>
              </button>
            </div>

            {/* Right Display Panels */}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              
              {/* Tab 1: Ingestion & Scoring */}
              {activeProtocolTab === 'pipeline' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', background: 'oklch(12% 0.01 240 / 0.4)', borderRadius: '24px', border: '1px solid oklch(100% 0 0 / 0.05)', padding: '2rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-lime)' }}>From External Model to MCP Tool</h3>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    NeuralRate does not pretend to be the model. It gives external AI clients a precise, inspectable tool surface for discovery, state, authorization, and governed execution.
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                    {[
                      { step: '01', title: 'Model Connects', desc: 'Any compatible external model or agent client connects over Streamable HTTP.' },
                      { step: '02', title: 'Tools Are Discovered', desc: 'The public endpoint advertises advisory tools only; scoped endpoints require authorization.' },
                      { step: '03', title: 'Owner Grants Scope', desc: 'A short-lived session grants only the selected state, config, benchmark, or execution domain.' },
                      { step: '04', title: 'Request Is Preflighted', desc: 'Vault state, runtime, asset, amount, destination, grant, and policy are checked before queueing.' },
                      { step: '05', title: 'Policy Is Enforced', desc: 'Allowed execution travels through the Safe7579 path and on-chain policy guard on Mantle.' },
                    ].map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', padding: '0.75rem 1rem', borderRadius: '12px', background: 'oklch(100% 0 0 / 0.01)', border: '1px solid oklch(100% 0 0 / 0.02)', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(223, 246, 81, 0.15)'; e.currentTarget.style.background = 'oklch(100% 0 0 / 0.015)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'oklch(100% 0 0 / 0.02)'; e.currentTarget.style.background = 'oklch(100% 0 0 / 0.01)'; }}>
                        <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--color-lime)', fontWeight: 700 }}>{s.step}</span>
                        <div style={{ textAlign: 'left' }}>
                          <strong style={{ display: 'block', fontSize: '0.85rem', color: '#fff' }}>{s.title}</strong>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{s.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 2: Cryptographic Anchor */}
              {activeProtocolTab === 'ledger' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'oklch(12% 0.01 240 / 0.4)', borderRadius: '24px', border: '1px solid oklch(100% 0 0 / 0.05)', padding: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-lime)' }}>Live On-Chain Execution Proof</h3>
                    <span style={{ fontSize: '0.62rem', padding: '0.25rem 0.5rem', borderRadius: '4px', background: 'rgba(223,246,81,0.06)', border: '1px solid rgba(223,246,81,0.12)', color: 'var(--color-lime)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>MANTLE_TESTNET</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    A successful scoped MCP request has already traversed the owner grant, policy checks, ERC-4337 runtime, Safe vault module, and Mantle Sepolia settlement.
                  </p>

                  {/* Glowing Contract Ticket Terminal (Non-generic, High-end) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1.25rem 1.5rem', borderRadius: '16px', background: 'oklch(8% 0.01 240 / 0.95)', border: '1px solid oklch(100% 0 0 / 0.06)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', textAlign: 'left', lineHeight: 1.6 }}>
                    <div style={{ borderBottom: '1px dashed oklch(100% 0 0 / 0.1)', paddingBottom: '0.75rem', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                      <span>LIVE PROOF DETAILS</span>
                      <span>MANTLE SEPOLIA</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Registry Contract:</span>
                      <span style={{ color: 'var(--color-lime)', wordBreak: 'break-all' }}>0xC0C836A220D006398cdE4D5caf529196E63f81A8</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Execution Transaction:</span>
                      <span style={{ color: '#fff', wordBreak: 'break-all' }}>0x36281947f5fb3088c29e6926979f150eb10ee03e5be86e4973599bf8823409b6</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Execution Path:</span>
                      <span style={{ color: '#fff', wordBreak: 'break-all' }}>MCP / ERC-4337 / Safe7579 / Vault Module</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed oklch(100% 0 0 / 0.1)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Receipt Status:</span>
                      <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>CONFIRMED ON MANTLE SEPOLIA</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'left' }}>
                    <a 
                      href="https://sepolia.mantlescan.xyz/tx/0x36281947f5fb3088c29e6926979f150eb10ee03e5be86e4973599bf8823409b6"
                      target="_blank" 
                      rel="noreferrer" 
                      className="onchain-verify-btn"
                      style={{ margin: 0, display: 'inline-flex' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                      <span>Inspect Live Execution Proof</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Tab 3: Safe Execution Sandbox */}
              {activeProtocolTab === 'sandbox' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'oklch(12% 0.01 240 / 0.4)', borderRadius: '24px', border: '1px solid oklch(100% 0 0 / 0.05)', padding: '2rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-lime)' }}>MCP Authorization & Safe Execution</h3>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    Public tools are read-only. Vault state and mutations live in separate scoped catalogs, and execution requests must pass the owner's active grant and on-chain policy.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr', gap: '2rem', textAlign: 'left' }} className="responsive-timeline-grid">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button 
                          onClick={() => setActiveCodeTab('mcp')} 
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.7rem', borderRadius: '6px', border: '1px solid oklch(100% 0 0 / 0.08)', background: activeCodeTab === 'mcp' ? 'var(--color-lime)' : 'rgba(255,255,255,0.02)', color: activeCodeTab === 'mcp' ? 'var(--bg-deep)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
                        >
                          MCP Tool Call
                        </button>
                        <button 
                          onClick={() => setActiveCodeTab('proof')} 
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.7rem', borderRadius: '6px', border: '1px solid oklch(100% 0 0 / 0.08)', background: activeCodeTab === 'proof' ? 'var(--color-lime)' : 'rgba(255,255,255,0.02)', color: activeCodeTab === 'proof' ? 'var(--bg-deep)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Owner Policy
                        </button>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                        {activeCodeTab === 'mcp' 
                          ? 'Simulate an external AI client calling the real public risk_assess tool without vault authority.'
                          : 'Define assets, destinations, selectors, delegates, value limits, and validity windows before execution.'}
                      </p>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                        <div style={{ fontSize: '0.68rem', padding: '0.25rem 0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid oklch(100% 0 0 / 0.05)', color: 'var(--text-secondary)', fontWeight: 600 }}>Streamable HTTP</div>
                        <div style={{ fontSize: '0.68rem', padding: '0.25rem 0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid oklch(100% 0 0 / 0.05)', color: 'var(--text-secondary)', fontWeight: 600 }}>Scoped Tokens</div>
                        <div style={{ fontSize: '0.68rem', padding: '0.25rem 0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid oklch(100% 0 0 / 0.05)', color: 'var(--text-secondary)', fontWeight: 600 }}>Fail-Closed Preflight</div>
                      </div>
                    </div>

                    {/* Console Sandbox Terminal */}
                    <div style={{ display: 'flex', flexDirection: 'column', background: 'oklch(10% 0.01 240 / 0.95)', borderRadius: '12px', border: '1px solid oklch(100% 0 0 / 0.06)', overflow: 'hidden' }}>
                      <div style={{ padding: '0.5rem 0.75rem', background: 'oklch(12% 0.01 240 / 0.8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid oklch(100% 0 0 / 0.05)' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>mcp_tool_call.json</span>
                        {activeCodeTab === 'mcp' && (
                          <button 
                            onClick={runMcpSandbox} 
                            disabled={isMcpRunning}
                            style={{ fontSize: '0.62rem', border: 'none', background: 'rgba(223, 246, 81, 0.1)', color: 'var(--color-lime)', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            {isMcpRunning ? 'RUNNING...' : '▸ CALL TOOL'}
                          </button>
                        )}
                      </div>
                      <div style={{ padding: '1rem', minHeight: '130px', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', textAlign: 'left', lineHeight: 1.45 }}>
                        {activeCodeTab === 'mcp' ? (
                          mcpConsoleLines.map((l, i) => (
                            <span key={i} style={{ color: l.startsWith('✓') ? 'var(--color-success)' : l.startsWith('▸') ? 'var(--color-lime)' : 'var(--text-secondary)' }}>
                              {l}
                            </span>
                          ))
                        ) : (
                          <div style={{ color: 'rgba(255,255,255,0.7)' }}>
                            <span style={{ color: 'var(--color-lime)' }}>const</span> safeTx = &#123;<br />
                            &nbsp;&nbsp;to: <span style={{ color: '#9d9eff' }}>"owner_allowlisted_target"</span>,<br />
                            &nbsp;&nbsp;value: <span style={{ color: '#fff' }}>"0"</span>,<br />
                            &nbsp;&nbsp;data: <span style={{ color: '#9d9eff' }}>"0xa9059cbb..."</span>,<br />
                            &nbsp;&nbsp;operation: <span style={{ color: '#fff' }}>0</span><br />
                            &#125;;<br />
                            <span style={{ color: 'var(--color-success)', marginTop: '0.25rem', display: 'inline-block' }}>✓ verified within daily limits!</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )}

            </div>

          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          4. TRUST METRICS & MARQUEE OF INTEGRATION BADGES
          ═══════════════════════════════════════════ */}
      <section className="home-section scroll-reveal" style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div className="section-header-compact" style={{ textAlign: 'center', margin: '0 auto 2rem' }}>
          <div className="section-kicker">Core System Integrations</div>
          <h2 className="section-title" style={{ fontSize: '1.65rem', color: 'var(--text-secondary)' }}>Powering the NeuralRate Stack</h2>
        </div>

        {/* CSS-Only infinite marquee of integration badges */}
        <div className="marquee-wrapper">
          <div className="marquee-track">
            {/* Round 1 */}
            <div className="marquee-badge">
              <span className="marquee-badge-icon" style={{ color: 'var(--color-lime)', fontWeight: 800 }}>M</span>
              <span>Mantle Network L2</span>
            </div>
            <div className="marquee-badge">
              <span className="marquee-badge-icon" style={{ color: '#fff', background: '#000', borderColor: 'rgba(255,255,255,0.2)' }}>S</span>
              <span>Safe Smart Accounts</span>
            </div>
            <div className="marquee-badge">
              <span className="marquee-badge-icon" style={{ color: 'var(--color-lime)' }}>P</span>
              <span>Privy Embedded Auth</span>
            </div>
            <div className="marquee-badge">
              <span className="marquee-badge-icon">M</span>
              <span>Model Context Protocol</span>
            </div>
            <div className="marquee-badge">
              <span className="marquee-badge-icon">4</span>
              <span>ERC-4337 Execution</span>
            </div>

            {/* Round 2 (Duplicate for seamless loop) */}
            <div className="marquee-badge">
              <span className="marquee-badge-icon" style={{ color: 'var(--color-lime)', fontWeight: 800 }}>M</span>
              <span>Mantle Network L2</span>
            </div>
            <div className="marquee-badge">
              <span className="marquee-badge-icon" style={{ color: '#fff', background: '#000', borderColor: 'rgba(255,255,255,0.2)' }}>S</span>
              <span>Safe Smart Accounts</span>
            </div>
            <div className="marquee-badge">
              <span className="marquee-badge-icon" style={{ color: 'var(--color-lime)' }}>P</span>
              <span>Privy Embedded Auth</span>
            </div>
            <div className="marquee-badge">
              <span className="marquee-badge-icon">M</span>
              <span>Model Context Protocol</span>
            </div>
            <div className="marquee-badge">
              <span className="marquee-badge-icon">4</span>
              <span>ERC-4337 Execution</span>
            </div>
          </div>
        </div>

        {/* 3 columns Trust Details */}
        <div className="trust-metrics-bar" style={{ marginTop: '4rem' }}>
          <div className="trust-metric-item">
            <div className="trust-metric-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <span className="trust-metric-number" style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--color-lime)', fontSize: '1.75rem' }}>Owner</span>
            <span className="trust-metric-label">Controls the Safe and Policy</span>
            <p className="trust-metric-desc" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>The owner controls the vault, signs the automation grant, defines allowed actions, and can revoke access.</p>
          </div>

          <div className="trust-metric-item">
            <div className="trust-metric-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <span className="trust-metric-number" style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--color-lime)', fontSize: '1.75rem' }}>Scoped</span>
            <span className="trust-metric-label">MCP Capability Exposure</span>
            <p className="trust-metric-desc" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>State, configuration, benchmark, and execution tools are advertised only to sessions authorized for that domain.</p>
          </div>

          <div className="trust-metric-item">
            <div className="trust-metric-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <span className="trust-metric-number" style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--color-lime)', fontSize: '1.75rem' }}>On-Chain</span>
            <span className="trust-metric-label">Execution Boundary</span>
            <p className="trust-metric-desc" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>The active policy and execution guard constrain the Safe module path before an authorized transaction can settle.</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          5. INTERACTIVE FAQ RESOLVER TERMINAL (Non-generic, Split Console)
          ═══════════════════════════════════════════ */}
      <section className="home-section scroll-reveal" id="faq" style={{ maxWidth: '1020px', margin: '0 auto', paddingTop: '4rem', paddingBottom: '6rem' }}>
        <div className="section-header-compact" style={{ textAlign: 'center', margin: '0 auto 3rem auto' }}>
          <div className="section-kicker">Operator Answers</div>
          <h2 className="section-title" style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Frequently Asked Questions</h2>
          <p className="section-desc" style={{ maxWidth: '600px', margin: '0.75rem auto 0' }}>
            Clear answers about what the external model controls, what NeuralRate controls, and where execution is enforced.
          </p>
        </div>

        <div className="responsive-timeline-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '3rem', marginTop: '3.5rem', textAlign: 'left', width: '100%' }}>
          
          {/* Left Column: Question Index Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', borderRight: '1px solid oklch(100% 0 0 / 0.05)', paddingRight: '2rem' }}>
            {[
              { index: '01', title: 'Who controls the vault?', category: 'OWNERSHIP' },
              { index: '02', title: 'What can public MCP clients do?', category: 'PUBLIC MCP' },
              { index: '03', title: 'Does NeuralRate provide the AI model?', category: 'MODEL ROLE' },
              { index: '04', title: 'Why is Mantle Network used?', category: 'ECOSYSTEM' },
              { index: '05', title: 'How does an agent get execution access?', category: 'AUTHORIZATION' }
            ].map((q, idx) => {
              const isActive = activeFaqIndex === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setActiveFaqIndex(idx)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: '1rem',
                    borderRadius: '12px',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    background: isActive ? 'oklch(100% 0 0 / 0.02)' : 'transparent',
                    borderLeft: isActive ? '2px solid var(--color-lime)' : '2px solid transparent',
                    paddingLeft: isActive ? '1.25rem' : '0.5rem',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'oklch(100% 0 0 / 0.008)';
                      e.currentTarget.style.paddingLeft = '0.75rem';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.paddingLeft = '0.5rem';
                    }
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.65rem', color: isActive ? 'var(--color-lime)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.08em' }}>
                      FAQ_[{q.index}] // {q.category}
                    </span>
                    {isActive && (
                      <span style={{ fontSize: '0.55rem', color: 'var(--color-lime)', fontFamily: 'var(--font-mono)', animation: 'pulse 1.5s infinite' }}>
                        ● ACTIVE
                      </span>
                    )}
                  </div>
                  <h4 style={{ margin: 0, fontSize: '0.94rem', color: isActive ? '#fff' : 'var(--text-secondary)', fontWeight: 700, transition: 'color 0.2s' }}>
                    {isActive ? '▸ ' : ''}{q.title}
                  </h4>
                </button>
              );
            })}
          </div>

          {/* Right Column: Decrypted Intelligence Monitor Screen */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1.5rem', 
                background: 'oklch(12% 0.01 240 / 0.4)', 
                borderRadius: '24px', 
                border: '1px solid oklch(100% 0 0 / 0.05)', 
                padding: '2.25rem',
                minHeight: '380px',
                justifyContent: 'space-between',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)'
              }}
            >
              {/* Terminal Screen Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid oklch(100% 0 0 / 0.05)', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-lime)', display: 'inline-block', animation: 'pulse 1s infinite' }}></span>
                  <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.05em' }}>
                    RESOLVER CONSOLE // DEC_Q_0{activeFaqIndex + 1}
                  </span>
                </div>
                <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  DECRYPT: OK
                </span>
              </div>

              {/* Dynamic Content Panel */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', justifyContent: 'center', margin: '0.5rem 0' }}>
                
                {/* Active Tab 0: Custody */}
                {activeFaqIndex === 0 && (
                  <div style={{ animation: 'fade-in-up 0.35s ease forwards', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(223, 246, 81, 0.06)', border: '1px solid rgba(223, 246, 81, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-lime)' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', fontWeight: 800 }}>Owner-Controlled Safe Vault</h3>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      The owner controls the Safe Smart Account and signs the policy and automation grant. NeuralRate can dispatch only requests that match the active authorization and policy; the owner can revoke that access.
                    </p>

                    {/* Safe Interactive Detail */}
                    <div style={{ padding: '1rem', borderRadius: '12px', background: 'oklch(8% 0.01 240 / 0.8)', border: '1px solid oklch(100% 0 0 / 0.05)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>OWNER AUTHORIZATION:</span>
                        <span style={{ color: 'var(--color-lime)' }}>ACTIVE AND REVOCABLE</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {['Signed Grant', 'On-Chain Policy', 'Scoped Session'].map((s, i) => (
                          <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', background: 'rgba(255,255,255,0.02)', border: '1px solid oklch(100% 0 0 / 0.04)', borderRadius: '6px', padding: '0.35rem 0', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed oklch(100% 0 0 / 0.08)', paddingTop: '0.5rem', marginTop: '0.25rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        <span>Execution rule:</span>
                        <span style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>Must match every active limit</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Tab 1: Recommend-only Mode */}
                {activeFaqIndex === 1 && (
                  <div style={{ animation: 'fade-in-up 0.35s ease forwards', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(223, 246, 81, 0.06)', border: '1px solid rgba(223, 246, 81, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-lime)' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="22" y1="12" x2="18" y2="12"></line>
                          <line x1="6" y1="12" x2="2" y2="12"></line>
                          <line x1="12" y1="6" x2="12" y2="2"></line>
                          <line x1="12" y1="22" x2="12" y2="18"></line>
                        </svg>
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', fontWeight: 800 }}>Public Read-Only MCP Catalog</h3>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      Any compatible client can discover five advisory tools for yields, T-Bill spreads, token context, deterministic risk, and allocation. This endpoint exposes no vault state and no mutation authority.
                    </p>

                    {/* Interactive Scan Simulator */}
                    <div style={{ padding: '1rem', borderRadius: '12px', background: 'oklch(8% 0.01 240 / 0.8)', border: '1px solid oklch(100% 0 0 / 0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>SIMULATE PUBLIC risk_assess CALL:</span>
                        <button
                          onClick={triggerFaqScan}
                          disabled={isFaqScanning}
                          style={{
                            fontSize: '0.65rem',
                            border: 'none',
                            background: isFaqScanning ? 'rgba(255,255,255,0.02)' : 'var(--color-lime)',
                            color: isFaqScanning ? 'var(--text-muted)' : 'var(--bg-deep)',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '6px',
                            fontWeight: 700,
                            cursor: isFaqScanning ? 'not-allowed' : 'pointer',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          {isFaqScanning ? 'SCANNING...' : '▸ RUN RADAR'}
                        </button>
                      </div>
                      <div style={{ background: 'oklch(5% 0.01 240 / 0.95)', border: '1px solid oklch(100% 0 0 / 0.04)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', minHeight: '52px', display: 'flex', alignItems: 'center' }}>
                        {faqScanResult ? (
                          <span style={{ color: faqScanResult.startsWith('✓') ? 'var(--color-success)' : 'var(--color-lime)' }}>{faqScanResult}</span>
                        ) : (
                          <span>Click "RUN RADAR" to simulate a read-only MCP risk assessment...</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Tab 2: 6-Factor Model */}
                {activeFaqIndex === 2 && (
                  <div style={{ animation: 'fade-in-up 0.35s ease forwards', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(223, 246, 81, 0.06)', border: '1px solid rgba(223, 246, 81, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-lime)' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="12 2 22 8.5 22 19.5 12 26 2 19.5 2 8.5"></polygon>
                          <line x1="12" y1="2" x2="12" y2="26"></line>
                          <line x1="2" y1="8.5" x2="22" y2="8.5"></line>
                        </svg>
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', fontWeight: 800 }}>Bring Your Own AI Model</h3>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      NeuralRate is not an embedded LLM and does not claim to replace agent reasoning. Your external model decides which MCP tool to request; NeuralRate validates authorization, returns structured state, and gates any execution.
                    </p>

                    <div style={{ padding: '1rem', borderRadius: '12px', background: 'oklch(8% 0.01 240 / 0.8)', border: '1px solid oklch(100% 0 0 / 0.05)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      {[
                        { name: 'External Model', weight: 'Reasoning', width: '100%' },
                        { name: 'MCP Server', weight: 'Tools', width: '100%' },
                        { name: 'Owner Grant', weight: 'Authority', width: '100%' },
                        { name: 'On-Chain Policy', weight: 'Limits', width: '100%' }
                      ].map((f, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', textAlign: 'left' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            <span>{f.name}</span>
                            <span style={{ color: 'var(--color-lime)', fontWeight: 700 }}>{f.weight}</span>
                          </div>
                          <div style={{ height: '4px', width: '100%', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: f.width, background: 'var(--color-lime)', borderRadius: '2px', boxShadow: '0 0 6px var(--color-lime)' }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Tab 3: Why Mantle */}
                {activeFaqIndex === 3 && (
                  <div style={{ animation: 'fade-in-up 0.35s ease forwards', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(223, 246, 81, 0.06)', border: '1px solid rgba(223, 246, 81, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-lime)' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                        </svg>
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', fontWeight: 800 }}>Mantle Ecosystem Synergy</h3>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      Mantle provides an EVM execution environment for the policy registry, execution guard, receipts, and Safe7579 vault path used by the current testnet deployment.
                    </p>

                      <div style={{ padding: '1rem', borderRadius: '12px', background: 'oklch(8% 0.01 240 / 0.8)', border: '1px solid oklch(100% 0 0 / 0.05)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>DEPLOYED ENFORCEMENT COMPONENTS:</span>
                        {['Policy Registry', 'Execution Guard', 'Safe Vault Module', 'Decision Receipt Registry'].map((component) => (
                          <div key={component} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.35rem 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{component}</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>MANTLE SEPOLIA</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed oklch(100% 0 0 / 0.08)', paddingTop: '0.5rem', marginTop: '0.25rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        <span>Current network:</span>
                        <span style={{ color: 'var(--color-success)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>CHAIN ID 5003</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Tab 4: Connect AI Agent */}
                {activeFaqIndex === 4 && (
                  <div style={{ animation: 'fade-in-up 0.35s ease forwards', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(223, 246, 81, 0.06)', border: '1px solid rgba(223, 246, 81, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-lime)' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                          <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                          <line x1="6" y1="6" x2="6.01" y2="6"></line>
                          <line x1="6" y1="18" x2="6.01" y2="18"></line>
                        </svg>
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', fontWeight: 800 }}>Owner-Scoped MCP Access</h3>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      Connect the external model to the public endpoint for read-only tools. Execution requires a separate owner-issued, time-bounded session token for the exact scoped catalog.
                    </p>

                    {/* Copyable MCP Command Box */}
                    <div style={{ padding: '1rem', borderRadius: '12px', background: 'oklch(8% 0.01 240 / 0.8)', border: '1px solid oklch(100% 0 0 / 0.05)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>CANONICAL STREAMABLE HTTP ENDPOINT:</span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'oklch(5% 0.01 240 / 0.95)', border: '1px solid oklch(100% 0 0 / 0.04)', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--color-lime)' }}>https://neuralrate-worker.neuralrate.workers.dev/mcp</span>
                        <button
                          onClick={(e) => {
                            navigator.clipboard.writeText('https://neuralrate-worker.neuralrate.workers.dev/mcp');
                            const btn = e.currentTarget;
                            btn.innerText = 'COPIED!';
                            setTimeout(() => { btn.innerText = 'COPY'; }, 1000);
                          }}
                          style={{
                            fontSize: '0.6rem',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid oklch(100% 0 0 / 0.05)',
                            color: 'var(--text-secondary)',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 700
                          }}
                        >
                          COPY
                        </button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.35rem', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        <span>AI Agent SDK</span>
                        <span style={{ color: 'var(--color-lime)' }}>--(MCP)--&gt;</span>
                        <span>NeuralRate Policy Layer</span>
                        <span style={{ color: 'var(--color-lime)' }}>--(Safe)--&gt;</span>
                        <span>Owner Vault</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Terminal Screen Footer decoration */}
              <div style={{ borderTop: '1px solid oklch(100% 0 0 / 0.05)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span>STATUS: SECURE INTERFACE ONLINE</span>
                <span>SYSTEM_SEC_LOG_v2.0.26</span>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ═══════════════════════════════════════════
          6. PRODUCT ROADMAP
          ═══════════════════════════════════════════ */}
      <section className="home-section roadmap-section scroll-reveal" id="roadmap">
        <div className="section-header-compact roadmap-header">
          <div className="section-kicker">Product Roadmap</div>
          <h2 className="section-title">A Solid Safety Core, Built to Expand.</h2>
          <p className="section-subtitle roadmap-intro">
            NeuralRate starts with governed vault execution on Mantle. The same MCP authorization model can secure more Web3 tools as each integration gains explicit schemas, preflight checks, and enforceable policy limits.
          </p>
        </div>

        <div className="roadmap-grid">
          {[
            {
              phase: 'Foundation',
              status: 'LIVE',
              title: 'Live Agent Execution & Safety Layer',
              description: 'External AI models can already request real on-chain MNT and Mock USDY testnet actions through scoped MCP catalogs, Safe vaults, and on-chain policy enforcement.',
              items: ['Mock USDY testnet route', 'Mantle Network', 'Safe7579 + ERC-4337'],
              current: true,
            },
            {
              phase: 'Expansion',
              status: 'NEXT',
              title: 'Broader Protocol Coverage',
              description: 'The governed action model already covers transfers, position lifecycle, rebalancing, approvals, reward checks, and strategy rotation. Next, we will pin real protocol-specific adapters and venues behind those controls.',
              items: ['Pinned protocol adapters', 'Real venue integrations', 'Expanded asset coverage'],
            },
            {
              phase: 'Network',
              status: 'PLANNED',
              title: 'Multi-Chain Policy Runtime',
              description: 'Carry consistent owner permissions and audit evidence across additional EVM networks without weakening chain-specific execution checks.',
              items: ['Chain-aware policies', 'Unified audit trail', 'Runtime verification'],
            },
            {
              phase: 'Ecosystem',
              status: 'VISION',
              title: 'Open Safety Infrastructure',
              description: 'Give builders reusable components to publish governed MCP tools that external AI models can discover and use inside explicit authority boundaries.',
              items: ['Integration SDK', 'Verified tool registry', 'Composable policies'],
            },
          ].map((milestone) => (
            <article className={`roadmap-card${milestone.current ? ' roadmap-card-current' : ''}`} key={milestone.phase}>
              <div className="roadmap-card-topline">
                <span className="roadmap-phase">{milestone.phase}</span>
                <span className={`roadmap-status${milestone.current ? ' roadmap-status-live' : ''}`}>{milestone.status}</span>
              </div>
              <h3>{milestone.title}</h3>
              <p>{milestone.description}</p>
              <div className="roadmap-tags">
                {milestone.items.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <p className="roadmap-disclaimer">
          Current live surface: MCP authorization and governed execution on Mantle Sepolia. Later milestones describe product direction, not currently available capabilities.
        </p>
      </section>

      {/* ═══════════════════════════════════════════
          7. FINAL CALL TO ACTION
          ═══════════════════════════════════════════ */}
      <section className="home-section glass-card-premium scroll-reveal" style={{ textAlign: 'center', padding: '5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', marginTop: '2rem', background: 'oklch(100% 0 0 / 0.015)', border: '1px solid oklch(100% 0 0 / 0.06)', borderRadius: '32px' }}>
        <div className="section-kicker">Verify & Audit</div>
        <h2 style={{ fontSize: '2.5rem', margin: 0, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
          Your Vault. Your Rules. Verified On-Chain.
        </h2>
        <p style={{ fontSize: '0.96rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 0.5rem', lineHeight: 1.65 }}>
          Connect an external AI model through MCP, define exactly what it may do, and audit the policy and execution evidence on Mantle.
        </p>
        <div className="hero-actions" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            className="btn-premium btn-premium-agent hero-btn shimmer-btn"
            onClick={() => setIsMcpModalOpen(true)}
            title="Connect an external AI model through MCP"
          >
            <span className="agent-dot agent-dot-active"></span>
            <span>Connect MCP</span>
          </button>

          <button className="btn-premium btn-premium-wallet hero-btn" onClick={() => onNavigate('/app')}>
            <span>Open Owner Console</span>
          </button>

          <button className="btn-premium hero-btn" onClick={() => onNavigate('/verify')} style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <span>Verify Evidence</span>
          </button>
          
          <button className="btn-premium hero-btn" onClick={() => onNavigate('/docs')} style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span>Read Specs</span>
          </button>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          8. PREMIUM MINIMAL FOOTER
          ═══════════════════════════════════════════ */}
      <footer className="home-footer-brand" style={{ paddingTop: '5rem', paddingBottom: '3rem', borderTop: '1px solid oklch(100% 0 0 / 0.04)', marginTop: '6rem' }}>
        <div className="footer-sitemap-grid" style={{ display: 'grid', gridTemplateColumns: '2fr repeat(3, 1fr)', gap: '4rem', textAlign: 'left', marginBottom: '3rem' }}>
          {/* Brand Col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                width: '32px', height: '32px',
                backgroundImage: 'url(/logo.png)', backgroundSize: 'cover', backgroundPosition: 'center',
                borderRadius: '8px', boxShadow: '0 0 10px rgba(223, 246, 81, 0.15)'
              }} />
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>NeuralRate</h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, maxWidth: '280px' }}>
              MCP authorization and execution infrastructure for external AI models, with owner-defined scopes and on-chain policy enforcement on Mantle.
            </p>
            <div className="hero-status-tag" style={{ margin: '0.25rem 0 0 0', padding: '0.25rem 0.65rem', fontSize: '0.65rem', alignSelf: 'flex-start' }}>
              <span className="pulse-dot"></span>
              <span>Mantle Sepolia Connected</span>
            </div>
          </div>

          {/* Platform Link Col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff' }}>Platform</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('/app'); }} style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-lime)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>Operator Terminal</a>
              <a href="#roadmap" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-lime)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>Product Roadmap</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('/verify'); }} style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-lime)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>Verify Proof Ledger</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('/docs'); }} style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-lime)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>Documentation Hub</a>
            </div>
          </div>

          {/* Trust Link Col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff' }}>Safety & Trust</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <a href="/docs/trust-assumptions.md" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-lime)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>Trust Models</a>
              <a href="/docs/risk-model.md" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-lime)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>6-Factor Score Spec</a>
              <a href="/docs/mcp-server.md" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-lime)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>MCP Server Spec</a>
              <a href="/docs/architecture.md" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-lime)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>System Design</a>
            </div>
          </div>

          {/* Specs Link Col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff' }}>Technical Specs</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <a href="/docs/smart-contract.md" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-lime)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>Smart Registry</a>
              <a href="/docs/database.md" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-lime)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>D1 Storage Schemas</a>
              <a href="/docs/frontend.md" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-lime)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>SPA Client Specs</a>
            </div>
          </div>
        </div>

        {/* Lower section */}
        <div style={{ borderTop: '1px solid oklch(100% 0 0 / 0.04)', paddingTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span>© {new Date().getFullYear()} NeuralRate. Published receipts and execution transactions are inspectable on Mantle.</span>
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
            <a href="/docs/README.md" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-lime)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>Quick Start Guide</a>
            <span>•</span>
            <a href="https://github.com/Lipe-lx/NeuralRate-MCP" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-lime)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>Open Source Core</a>
          </div>
        </div>
      </footer>

      <McpConnectModal isOpen={isMcpModalOpen} onClose={() => setIsMcpModalOpen(false)} mcpAccessBundle={mcpAccessBundle} />
    </div>
    </>
  );
};

export default HomePanel;
