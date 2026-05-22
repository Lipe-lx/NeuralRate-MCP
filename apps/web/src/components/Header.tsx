import React, { useState } from 'react';
import McpConnectModal from './McpConnectModal';
import { useWalletContext } from '../context/WalletContext';

const Header: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isConnected, isConnecting, isCorrectChain, shortAddress, connect, disconnect, switchToMantle, error } = useWalletContext();

  return (
    <header className="animate-enter" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 0', marginBottom: '1rem', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: '48px', 
          height: '48px', 
          backgroundImage: 'url(/logo.png)', 
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: '12px',
          boxShadow: '0 0 15px var(--color-lime-glow)'
        }} />
        <h1 className="text-gradient" style={{ fontSize: '1.5rem', margin: 0, fontWeight: 700 }}>StableSync</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* MCP Agent Access Button */}
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-premium btn-premium-agent"
          title="Connect AI Agent to MCP"
        >
          <span className="agent-dot agent-dot-active"></span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.5px' }}>AGENT ACCESS</span>
        </button>

        {/* Wallet Connect Button */}
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
            {/* Chain indicator */}
            {!isCorrectChain && (
              <button
                onClick={switchToMantle}
                className="btn-premium btn-premium-switch"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
              >
                ⚠ Switch to Mantle
              </button>
            )}

            {/* Connected wallet pill */}
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
