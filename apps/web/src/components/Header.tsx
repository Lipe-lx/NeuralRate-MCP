import React, { useState } from 'react';
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
  const { isConnected, isConnecting, isCorrectChain, shortAddress, connect, disconnect, switchToMantle, error } = useWalletContext();

  return (
    <header className="animate-enter" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: compact ? '0.35rem 0' : '0.75rem 0', marginBottom: compact ? '0.25rem' : '1rem', flexShrink: 0 }}>
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
          style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }} 
          onClick={() => {
            window.history.pushState({}, '', '/');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
        >
          <div style={{
            width: '32px',
            height: '32px',
            backgroundImage: 'url(/logo.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: '8px',
            boxShadow: '0 0 10px var(--color-lime-glow)'
          }} />
          <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>NeuralRate</span>
        </div>
      )}

      {!compact && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="btn-premium btn-premium-agent"
              title="Connect AI Agent to MCP"
            >
              <span className="agent-dot agent-dot-active"></span>
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
        </div>
      )}

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
