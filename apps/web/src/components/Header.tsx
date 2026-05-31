import React, { useState, useEffect } from 'react';
import McpConnectModal from './McpConnectModal';
import { useWalletContext } from '../context/WalletContext';

type VaultHeaderTab = 'vault' | 'settings' | 'history';

type HeaderProps = {
  vaultTabsVisible?: boolean;
  activeVaultTab?: VaultHeaderTab;
  onVaultTabChange?: (tab: VaultHeaderTab) => void;
  compact?: boolean;
};

const Header: React.FC<HeaderProps> = ({ vaultTabsVisible = false, activeVaultTab, onVaultTabChange, compact = false }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { isConnected, isConnecting, isCorrectChain, shortAddress, connect, disconnect, switchToMantle, error } = useWalletContext();

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
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        background: compact 
          ? (isScrolled ? 'var(--bg-surface-glass)' : 'transparent') 
          : 'transparent',
        backdropFilter: compact && isScrolled ? 'blur(16px)' : 'none',
        WebkitBackdropFilter: compact && isScrolled ? 'blur(16px)' : 'none',
        borderBottom: compact 
          ? (isScrolled ? '1px solid oklch(100% 0 0 / 0.05)' : '1px solid transparent') 
          : 'none',
      }}
    >
      {/* LEFT: LOGO */}
      {vaultTabsVisible && activeVaultTab && onVaultTabChange ? (
        <div className="vault-subnav vault-subnav-header">
          <button className={`vault-subnav-item ${activeVaultTab === 'vault' ? 'active' : ''}`} onClick={() => onVaultTabChange('vault')}>
            Vault
          </button>
          <button className={`vault-subnav-item ${activeVaultTab === 'settings' ? 'active' : ''}`} onClick={() => onVaultTabChange('settings')}>
            Agent Settings
          </button>
          <button className={`vault-subnav-item ${activeVaultTab === 'history' ? 'active' : ''}`} onClick={() => onVaultTabChange('history')}>
            Benchmark History
          </button>
        </div>
      ) : (
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', zIndex: 1010 }} 
          onClick={() => navigateTo('/')}
        >
          <div style={{
            width: '32px',
            height: '32px',
            backgroundImage: 'url(/logo.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: '8px',
            boxShadow: '0 0 10px rgba(223, 246, 81, 0.15)'
          }} />
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>NeuralRate</span>
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
          <a href="#features" onClick={(e) => handleAnchorClick(e, 'features')} className="nav-link-item">Features</a>
          <a href="#how-it-works" onClick={(e) => handleAnchorClick(e, 'how-it-works')} className="nav-link-item">How It Works</a>
          <a href="/docs" onClick={(e) => { e.preventDefault(); navigateTo('/docs'); }} className="nav-link-item">Docs</a>
          <a href="/verify" onClick={(e) => { e.preventDefault(); navigateTo('/verify'); }} className="nav-link-item">Verify Evidence</a>

          {/* MOBILE ACTIONS */}
          {isMobileMenuOpen && (
            <div className="mobile-menu-actions" style={{ display: 'none', flexDirection: 'column', gap: '1rem', width: '100%', marginTop: '2rem' }}>
              <button 
                onClick={() => { setIsMobileMenuOpen(false); setIsModalOpen(true); }}
                className="btn-premium btn-premium-agent"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span className="agent-dot"></span>
                <span>AGENT ACCESS</span>
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
              title="Connect AI Agent to MCP"
              style={{ padding: '0.55rem 1.1rem', fontSize: '0.75rem' }}
            >
              <span className="agent-dot"></span>
              <span style={{ letterSpacing: '0.5px' }}>AGENT ACCESS</span>
            </button>
            
            <button 
              onClick={() => navigateTo('/app')}
              className="btn-premium btn-premium-wallet"
              style={{ padding: '0.55rem 1.1rem', fontSize: '0.75rem' }}
            >
              <span>LAUNCH TERMINAL</span>
            </button>
          </div>
        ) : (
          // Workspace actions (original wallet connections)
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="btn-premium btn-premium-agent"
              title="Connect AI Agent to MCP"
            >
              <span className="agent-dot"></span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.5px' }}>AGENT ACCESS</span>
            </button>

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

        {/* MOBILE MENU HAMBURGER (HOMEPAGE ONLY) */}
        {compact && (
          <button 
            className={`hamburger-menu ${isMobileMenuOpen ? 'open' : ''}`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
            style={{
              display: 'none',
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

      <McpConnectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </header>
  );
};

export default Header;
