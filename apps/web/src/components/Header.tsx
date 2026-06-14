import React, { useState, useEffect } from 'react';
import McpConnectModal from './McpConnectModal';
import { useWalletContext } from '../context/WalletContext';

import { type McpAccessBundle } from '../lib/mcpAccess';

type VaultHeaderTab = 'vault' | 'telemetry' | 'settings' | 'history';

type HeaderProps = {
  vaultTabsVisible?: boolean;
  activeVaultTab?: VaultHeaderTab;
  onVaultTabChange?: (tab: VaultHeaderTab) => void;
  compact?: boolean;
  showAgentAccess?: boolean;
  mcpAccessBundle?: McpAccessBundle | null;
  subtitle?: string;
};

const Header: React.FC<HeaderProps> = ({
  vaultTabsVisible = false,
  activeVaultTab,
  onVaultTabChange,
  compact = false,
  showAgentAccess = true,
  mcpAccessBundle,
  subtitle,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const { isConnected, isConnecting, isCorrectChain, shortAddress, connect, disconnect, switchToMantle, error } = useWalletContext();

  // IntersectionObserver to track active homepage section
  useEffect(() => {
    if (!compact) return;

    const sectionIds = ['hero-section', 'poc-simulator', 'how-it-works', 'faq', 'roadmap'];
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
          }
        },
        { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [compact]);

  // Track scroll position to change background opacity
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 15) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);
    
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', `/#${id}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      
      // Delay slightly to allow homepage mounting before scroll
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const navigateTo = (path: string) => {
    setIsMobileMenuOpen(false);
    if (window.location.pathname === path) return;
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <header 
      className={`header-premium ${isScrolled ? 'scrolled' : ''} ${compact ? 'homepage-nav' : 'workspace-nav'}`}
      style={{
        position: compact ? 'sticky' : 'relative',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: compact ? '0.75rem 2rem' : '0.75rem 0',
        marginBottom: compact ? '0' : '1rem',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        background: compact 
          ? (isScrolled ? 'var(--bg-surface-glass)' : 'transparent') 
          : 'transparent',
        backdropFilter: compact && isScrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: compact && isScrolled ? 'blur(20px)' : 'none',
        borderBottom: compact 
          ? (isScrolled ? '1px solid oklch(100% 0 0 / 0.08)' : '1px solid transparent') 
          : 'none',
      }}
    >
      {/* LEFT: LOGO */}
      {vaultTabsVisible && activeVaultTab && onVaultTabChange ? (
        <div className="vault-subnav vault-subnav-header">
          <button className={`vault-subnav-item ${activeVaultTab === 'vault' ? 'active' : ''}`} onClick={() => onVaultTabChange('vault')}>
            Vault
          </button>
          <button className={`vault-subnav-item ${activeVaultTab === 'telemetry' ? 'active' : ''}`} onClick={() => onVaultTabChange('telemetry')}>
            Telemetry
          </button>
          <button className={`vault-subnav-item ${activeVaultTab === 'settings' ? 'active' : ''}`} onClick={() => onVaultTabChange('settings')}>
            Agent Settings
          </button>
          <button className={`vault-subnav-item ${activeVaultTab === 'history' ? 'active' : ''}`} onClick={() => onVaultTabChange('history')}>
            Benchmark History
          </button>
        </div>
      ) : compact ? (
        <div style={{ width: '0px' }} />
      ) : (
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', zIndex: 1010 }} 
        >
          {subtitle && (
            <span style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              {subtitle}
            </span>
          )}
        </div>
      )}

      {/* CENTER: NAV LINKS (HOMEPAGE ONLY) */}
      {compact && (
        <nav 
          className={`nav-links-container ${isMobileMenuOpen ? 'mobile-open' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2rem',
          }}
        >
          <a href="#hero-section" onClick={(e) => handleAnchorClick(e, 'hero-section')} className={`nav-link-item ${activeSection === 'hero-section' ? 'active' : ''}`}>Home</a>
          <a href="#poc-simulator" onClick={(e) => handleAnchorClick(e, 'poc-simulator')} className={`nav-link-item ${activeSection === 'poc-simulator' ? 'active' : ''}`}>Risk Simulator</a>
          <a href="#how-it-works" onClick={(e) => handleAnchorClick(e, 'how-it-works')} className={`nav-link-item ${activeSection === 'how-it-works' ? 'active' : ''}`}>Security Protocol</a>
          <a href="#faq" onClick={(e) => handleAnchorClick(e, 'faq')} className={`nav-link-item ${activeSection === 'faq' ? 'active' : ''}`}>FAQ</a>
          <a href="#roadmap" onClick={(e) => handleAnchorClick(e, 'roadmap')} className={`nav-link-item ${activeSection === 'roadmap' ? 'active' : ''}`}>Roadmap</a>

          {/* MOBILE ACTIONS */}
          {isMobileMenuOpen && (
            <div className="mobile-menu-actions" style={{ display: 'none', flexDirection: 'column', gap: '1rem', width: '100%', marginTop: '2rem' }}>
              <button 
                onClick={() => { setIsMobileMenuOpen(false); setIsModalOpen(true); }}
                className="btn-premium btn-premium-agent"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span className="agent-dot"></span>
                <span>CONNECT MCP</span>
              </button>
              <button 
                onClick={() => navigateTo('/app')}
                className="btn-premium btn-premium-wallet"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span>LAUNCH TERMINAL</span>
              </button>
            </div>
          )}
        </nav>
      )}

      {/* RIGHT: ACTIONS (WALLET / TERMINAL) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 1010 }}>
        {compact ? (
          // Homepage actions
          <div className="desktop-actions-only" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="btn-premium btn-premium-agent"
              title="Connect an external AI model through MCP"
              style={{ padding: '0.55rem 1.1rem', fontSize: '0.75rem' }}
            >
              <span className="agent-dot agent-dot-active"></span>
              <span style={{ letterSpacing: '0.5px' }}>CONNECT MCP</span>
            </button>
            
            <button 
              onClick={() => navigateTo('/app')}
              className="btn-premium btn-premium-wallet shimmer-btn"
              style={{ padding: '0.55rem 1.1rem', fontSize: '0.75rem' }}
            >
              <span>LAUNCH TERMINAL</span>
            </button>
          </div>
        ) : (
          // Workspace actions (original wallet connections)
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {showAgentAccess && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn-premium btn-premium-agent"
                title="Connect an external AI model through MCP"
              >
                <span className="agent-dot"></span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.5px' }}>CONNECT MCP</span>
              </button>
            )}

            {!isConnected ? (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="btn-premium btn-premium-wallet"
                style={{ cursor: isConnecting ? 'wait' : 'pointer', opacity: isConnecting ? 0.7 : 1 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="2" y="6" width="20" height="14" rx="3" />
                  <path d="M16 14h.01" />
                  <path d="M2 10h20" />
                </svg>
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {!isCorrectChain && (
                  <button
                    onClick={switchToMantle}
                    className="btn-premium btn-premium-switch"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                  >
                    ⚠ Switch to Mantle
                  </button>
                )}

                <button
                  onClick={disconnect}
                  className="btn-premium btn-premium-connected"
                  onMouseOver={e => {
                    const label = e.currentTarget.querySelector('[data-wallet-label]') as HTMLElement;
                    if (label) label.textContent = 'Disconnect';
                  }}
                  onMouseOut={e => {
                    const label = e.currentTarget.querySelector('[data-wallet-label]') as HTMLElement;
                    if (label) label.textContent = shortAddress;
                  }}
                  title="Click to disconnect"
                >
                  <span className="wallet-dot-active" style={{ width: '8px', height: '8px', borderRadius: '50%', background: isCorrectChain ? 'var(--color-success)' : 'var(--color-warning)', display: 'inline-block' }}></span>
                  <span data-wallet-label style={{ fontSize: '0.8rem', color: 'inherit', fontWeight: 600, letterSpacing: '0.5px' }}>
                    {shortAddress}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        <a 
          href="https://github.com/Lipe-lx/NeuralRate-MCP" 
          target="_blank" 
          rel="noreferrer" 
          title="GitHub Repository"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '36px', 
            height: '36px', 
            borderRadius: '10px', 
            border: '1px solid oklch(100% 0 0 / 0.08)', 
            background: 'oklch(14% 0.01 240 / 0.65)', 
            color: 'var(--text-secondary)',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            cursor: 'pointer',
            flexShrink: 0,
            textDecoration: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.borderColor = 'rgba(223, 246, 81, 0.4)';
            e.currentTarget.style.background = 'rgba(223, 246, 81, 0.05)';
            e.currentTarget.style.boxShadow = '0 0 12px rgba(223, 246, 81, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.borderColor = 'oklch(100% 0 0 / 0.08)';
            e.currentTarget.style.background = 'oklch(14% 0.01 240 / 0.65)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </a>

        {/* MOBILE MENU HAMBURGER (HOMEPAGE ONLY) */}
        {compact && (
          <button 
            className={`hamburger-menu ${isMobileMenuOpen ? 'open' : ''}`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
            style={{
              cursor: 'pointer',
              padding: '0.5rem',
              flexDirection: 'column',
              gap: '6px',
              justifyContent: 'center',
              alignItems: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              border: '1px solid oklch(100% 0 0 / 0.05)',
              background: 'oklch(100% 0 0 / 0.02)'
            }}
          >
            <span style={{ width: '20px', height: '2px', background: 'var(--text-primary)', transition: 'all 0.3s' }}></span>
            <span style={{ width: '20px', height: '2px', background: 'var(--text-primary)', transition: 'all 0.3s' }}></span>
            <span style={{ width: '20px', height: '2px', background: 'var(--text-primary)', transition: 'all 0.3s' }}></span>
          </button>
        )}
      </div>

      {error && (
        <div style={{ position: 'fixed', top: '1rem', right: '1rem', background: 'rgba(255, 77, 79, 0.15)', border: '1px solid rgba(255, 77, 79, 0.3)', color: 'var(--color-danger)', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.8rem', zIndex: 10000, maxWidth: '300px' }}>
          {error}
        </div>
      )}

      <McpConnectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} mcpAccessBundle={mcpAccessBundle} />
    </header>
  );
};

export default Header;
