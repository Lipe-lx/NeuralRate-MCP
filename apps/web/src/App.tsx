import { useState } from 'react';

// Components
import Header from './components/Header';
import YieldScanner from './components/YieldScanner';
import RiskPanel from './components/RiskPanel';
import NansenRadar from './components/NansenRadar';
import DecisionLedger from './components/DecisionLedger';
import VaultPanel from './components/VaultPanel';
import AgentSettingsPanel from './components/AgentSettingsPanel';
import WalletOwnershipModal from './components/WalletOwnershipModal';
import { useApi } from './hooks/useApi';
import { WalletProvider } from './context/WalletContext';
import { useWalletContext } from './context/WalletContext';
import { useNeuralRateUser } from './hooks/useNeuralRateUser';

export interface Pool {
  symbol: string;
  project: string;
  apy: number;
  tvlUsd: number;
  pool: string;
  apyBase: number;
  apyReward: number | null;
  ilRisk: string | null;
  exposure: string | null;
  volumeUsd1d: number | null;
  volumeUsd7d: number | null;
  apyPct1D: number | null;
  apyPct7D: number | null;
  apyPct30D: number | null;
  apyMean30d: number | null;
  stablecoin: boolean;
  sigma: number | null;
  underlyingTokens?: string[] | null;
  rewardTokens?: string[] | null;
}

function AppContent() {
  const { data, loading } = useApi<{ pools: Pool[] }>('/yields');
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'principal' | 'vault'>('principal');
  const [activeVaultTab, setActiveVaultTab] = useState<'vault' | 'settings' | 'history'>('vault');
  const [isOwnershipModalOpen, setIsOwnershipModalOpen] = useState(false);
  const wallet = useWalletContext();
  const { address, isConnected, isCorrectChain, connect, switchToMantle } = wallet;
  const neuralRateUser = useNeuralRateUser({
    ownerEoa: address,
    externalWalletAddress: wallet.externalWalletAddress,
    embeddedWalletAddress: wallet.embeddedWalletAddress,
    providerUserId: wallet.providerUserId,
    authStrategy: wallet.authStrategy,
    walletProvider: wallet.walletProvider,
    canPredictVault: isConnected && isCorrectChain,
    getEthereumProvider: wallet.getEthereumProvider,
    signMessage: wallet.signMessage,
  });

  const selectedPool =
    (selectedPoolId ? data?.pools?.find((pool) => pool.pool === selectedPoolId) ?? null : null) ??
    data?.pools?.[0] ??
    null;

  const controlWalletAddress = wallet.embeddedWalletAddress ?? wallet.address;
  const controlWalletLabel = wallet.embeddedWalletAddress
    ? 'Control Wallet (Embedded)'
    : wallet.address
      ? 'Control Wallet'
      : 'Control Wallet';

  const handleBootstrap = async () => {
    const nextState = await neuralRateUser.bootstrap();
    if (nextState?.vault?.vault_address && !nextState.vault.ownership_acknowledged_at) {
      setIsOwnershipModalOpen(true);
    }
    return nextState;
  };

  const handleAcknowledgeOwnership = async () => {
    await neuralRateUser.acknowledgeOwnership();
    setIsOwnershipModalOpen(false);
  };

  return (
    <div className="container" style={{ height: '100vh', display: 'flex', flexDirection: 'row', gap: '1.5rem', overflow: 'hidden', padding: '1rem' }}>
      {/* Floating Sidebar Navigation */}
      <aside className="opacity-100" style={{ width: '240px', flexShrink: 0, height: '100%' }}>
        <div className="sidebar-floating">
          <div className="sidebar-brand">
            <div style={{
              width: '40px', 
              height: '40px', 
              backgroundImage: 'url(/logo.png)', 
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              borderRadius: '10px',
              boxShadow: '0 0 12px var(--color-lime-glow)'
            }} />
            <div>
              <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>NeuralRate</h2>
              <span style={{ fontSize: '0.58rem', color: 'var(--color-lime)', opacity: 0.85, fontWeight: 600, display: 'block', marginTop: '0.1rem', lineHeight: '1.2' }}>Vault benchmark terminal on Mantle Sepolia</span>
            </div>
          </div>
          
          <nav className="sidebar-nav">
            <button className={`sidebar-nav-item ${activeTab === 'principal' ? 'active' : ''}`} onClick={() => setActiveTab('principal')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Terminal</span>
            </button>
            <button className={`sidebar-nav-item ${activeTab === 'vault' ? 'active' : ''}`} onClick={() => setActiveTab('vault')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Agent Vault</span>
            </button>
          </nav>
          
          <div className="sidebar-footer">
            <div>Mantle Sepolia</div>
            <div style={{ color: 'var(--color-lime)', fontWeight: 'bold', marginTop: '0.2rem' }}>Online</div>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="opacity-100" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, height: '100%', maxWidth: '1380px', margin: '0 auto' }}>
        <Header
          vaultTabsVisible={activeTab === 'vault'}
          activeVaultTab={activeVaultTab}
          onVaultTabChange={setActiveVaultTab}
        />

        <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'principal' && (
            <div className="tab-pane animate-enter" style={{ display: 'grid', gridTemplateColumns: '370px 1fr', gap: '1.25rem', height: '100%' }}>
              {/* Left Column: Risk and Nansen */}
              <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0, height: '100%', overflowY: 'auto' }}>
                <RiskPanel selectedPool={selectedPool} />
                <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', margin: '0.25rem 0' }} />
                <NansenRadar selectedPool={selectedPool} pools={data?.pools || []} />
              </aside>

              {/* Right Column: Yield Scanner */}
              <div className="organic-col-divider" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
                <YieldScanner 
                  pools={data?.pools || []} 
                  loading={loading} 
                  onSelectPool={(pool) => setSelectedPoolId(pool?.pool ?? null)} 
                  selectedPool={selectedPool} 
                />
              </div>
            </div>
          )}

          {activeTab === 'vault' && (
            <div className="tab-pane animate-enter" style={{ minHeight: 0 }}>
              <div style={{ flex: 1, minHeight: 0, overflowY: activeVaultTab === 'settings' ? 'auto' : 'hidden', paddingRight: '0.25rem' }}>
                {activeVaultTab === 'vault' && (
                  <div className="centered-page-container" style={{ maxWidth: '1160px', margin: '0.65rem auto 0', height: '100%' }}>
                    <VaultPanel
                      state={neuralRateUser.state}
                      busy={neuralRateUser.busy}
                      notice={neuralRateUser.notice}
                      error={neuralRateUser.error}
                      isConnected={isConnected}
                      isCorrectChain={isCorrectChain}
                      onConnect={connect}
                      onSwitchChain={switchToMantle}
                      onBootstrap={handleBootstrap}
                      onFundingIntent={neuralRateUser.createFundingIntent}
                      onEnableAutomation={neuralRateUser.enableAutomation}
                      onRevokeAutomation={neuralRateUser.revokeAutomation}
                      onQueueDemoStrategy={neuralRateUser.queueDemoStrategy}
                      onReviewOwnership={() => setIsOwnershipModalOpen(true)}
                      controlWalletLabel={controlWalletLabel}
                    />
                  </div>
                )}

                {activeVaultTab === 'settings' && (
                  <div className="centered-page-container" style={{ maxWidth: '1200px', margin: '0.65rem auto 0' }}>
                    <AgentSettingsPanel
                      config={neuralRateUser.state?.config ?? null}
                      busy={neuralRateUser.busy}
                      onSave={neuralRateUser.saveConfig}
                    />
                  </div>
                )}

                {activeVaultTab === 'history' && (
                  <div className="centered-page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, maxWidth: '1200px', margin: '0.65rem auto 0' }}>
                    <DecisionLedger
                      state={neuralRateUser.state}
                      busy={neuralRateUser.busy || neuralRateUser.loading}
                      onRefreshAutomation={neuralRateUser.refresh}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        <footer style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0, marginTop: '1rem' }}>
          NeuralRate MCP • Per-User Vault Automation + Benchmark Terminal • Mantle Sepolia
        </footer>
      </div>

      {isOwnershipModalOpen && (
        <WalletOwnershipModal
          isOpen={isOwnershipModalOpen}
          busy={neuralRateUser.busy}
          vaultAddress={neuralRateUser.state?.vault?.vault_address ?? null}
          controlWalletAddress={controlWalletAddress}
          controlWalletLabel={controlWalletLabel}
          walletProvider={wallet.walletProvider}
          canExportEmbeddedWallet={wallet.canExportEmbeddedWallet}
          embeddedWalletRecoveryMethod={wallet.embeddedWalletRecoveryMethod}
          alreadyAcknowledged={Boolean(neuralRateUser.state?.vault?.ownership_acknowledged_at)}
          acknowledgedAt={neuralRateUser.state?.vault?.ownership_acknowledged_at ?? null}
          onClose={() => setIsOwnershipModalOpen(false)}
          onExportEmbeddedWallet={wallet.exportEmbeddedWallet}
          onSetEmbeddedWalletRecovery={wallet.setEmbeddedWalletRecovery}
          onAcknowledge={handleAcknowledgeOwnership}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
}

export default App;
