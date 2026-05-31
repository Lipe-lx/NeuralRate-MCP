import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import YieldScanner from './components/YieldScanner';
import RiskPanel from './components/RiskPanel';
import NansenRadar from './components/NansenRadar';
import DecisionLedger from './components/DecisionLedger';
import VaultPanel from './components/VaultPanel';
import AgentSettingsPanel from './components/AgentSettingsPanel';
import WalletOwnershipModal from './components/WalletOwnershipModal';
import VerifyPanel from './components/VerifyPanel';
import HomePanel from './components/HomePanel';
import { useApi } from './hooks/useApi';
import { WalletProvider } from './context/WalletContext';
import { useWalletContext } from './context/WalletContext';
import { useNeuralRateUser } from './hooks/useNeuralRateUser';
import { API_BASE_URL, ENV_PROFILE } from './config';

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

type AppRoute = 'home' | 'app' | 'docs' | 'verify';
type AppTab = 'terminal' | 'vault' | 'verify';

const resolveRoute = (pathname: string): AppRoute => {
  if (pathname === '/app') return 'app';
  if (pathname === '/docs') return 'docs';
  if (pathname === '/verify') return 'verify';
  return 'home';
};

const navigateTo = (path: string) => {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

const docFiles = [
  'README.md',
  'risk-model.md',
  'trust-assumptions.md',
  'mcp-server.md',
  'architecture.md',
  'deployment.md',
  'smart-contract.md',
  'database.md',
  'frontend.md',
];

function AppContent() {
  const { data, loading } = useApi<{ pools: Pool[] }>('/yields');
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [route, setRoute] = useState<AppRoute>(() => resolveRoute(window.location.pathname));
  const [activeTab, setActiveTab] = useState<AppTab>(() => (window.location.pathname === '/verify' ? 'verify' : 'terminal'));
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

  useEffect(() => {
    const onPop = () => {
      const next = resolveRoute(window.location.pathname);
      setRoute(next);
      if (next === 'verify') {
        setActiveTab('verify');
      } else if (next === 'app') {
        setActiveTab('terminal');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const sendTelemetry = async (level: 'error' | 'warning', message: string, metadata: Record<string, unknown>) => {
      try {
        await fetch(`${API_BASE_URL}/telemetry/error`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'web',
            level,
            message,
            route: window.location.pathname,
            metadata: {
              ...metadata,
              envProfile: ENV_PROFILE,
            },
          }),
        });
      } catch {
        // best-effort telemetry only
      }
    };

    const onError = (event: ErrorEvent) => {
      void sendTelemetry('error', event.message || 'Unhandled window error', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason =
        typeof event.reason === 'string'
          ? event.reason
          : event.reason instanceof Error
            ? event.reason.message
            : 'Unhandled promise rejection';
      void sendTelemetry('error', reason, { kind: 'unhandledrejection' });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  const pools = data?.pools ?? [];
  const selectedPool = useMemo(() => {
    if (selectedPoolId) {
      return pools.find((pool) => pool.pool === selectedPoolId) ?? null;
    }
    return pools[0] ?? null;
  }, [pools, selectedPoolId]);

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

  const pageTitle = useMemo(() => {
    if (route === 'home') return 'Yield Intelligence With Optional Vault Automation';
    if (route === 'docs') return 'Technical Documentation';
    if (route === 'verify') return 'Public Verification';
    return 'Operator Workspace';
  }, [route]);

  if (route === 'home') {
    return (
      <div className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header compact />
        <HomePanel onNavigate={navigateTo} />
      </div>
    );
  }

  if (route === 'docs') {
    return (
      <div className="container" style={{ minHeight: '100vh', padding: '1.25rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '1080px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Header compact />
          <section className="glass-panel animate-enter">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.9rem' }}>
              <h1 style={{ margin: 0, fontSize: '1.45rem' }}>{pageTitle}</h1>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-premium" onClick={() => navigateTo('/')}>Back to Home</button>
                <button className="btn-premium btn-premium-wallet" onClick={() => navigateTo('/app')}>Open Terminal</button>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.95rem' }}>
              Public markdown docs are published as crawler-friendly files under <code>/docs/*</code>.
            </p>
            <div style={{ display: 'grid', gap: '0.65rem' }}>
              {docFiles.map((doc) => (
                <a
                  key={doc}
                  href={`/docs/${doc}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '0.7rem 0.8rem',
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    fontSize: '0.85rem',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  {doc}
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (route === 'verify') {
    return (
      <div className="container" style={{ minHeight: '100vh', padding: '1.25rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Header compact />
          <section className="glass-panel animate-enter">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.8rem' }}>
              <h1 style={{ margin: 0, fontSize: '1.45rem' }}>{pageTitle}</h1>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-premium" onClick={() => navigateTo('/')}>Back to Home</button>
                <button className="btn-premium btn-premium-wallet" onClick={() => navigateTo('/app')}>Open Terminal</button>
              </div>
            </div>
            <VerifyPanel />
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ height: '100vh', display: 'flex', flexDirection: 'row', gap: '1.5rem', overflow: 'hidden', padding: '1rem' }}>
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
              <span style={{ fontSize: '0.58rem', color: 'var(--color-lime)', opacity: 0.85, fontWeight: 600, display: 'block', marginTop: '0.1rem', lineHeight: '1.2' }}>
                Yield operator terminal with optional automation
              </span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <button className={`sidebar-nav-item ${activeTab === 'terminal' ? 'active' : ''}`} onClick={() => setActiveTab('terminal')}>
              <span>Terminal</span>
            </button>
            <button className={`sidebar-nav-item ${activeTab === 'vault' ? 'active' : ''}`} onClick={() => setActiveTab('vault')}>
              <span>Vault Automation</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            <div>Mantle Sepolia</div>
            <div style={{ color: 'var(--color-lime)', fontWeight: 'bold', marginTop: '0.2rem' }}>Operator Mode</div>
          </div>
        </div>
      </aside>

      <div className="opacity-100" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, height: '100%', maxWidth: '1380px', margin: '0 auto' }}>
        <Header
          vaultTabsVisible={activeTab === 'vault'}
          activeVaultTab={activeVaultTab}
          onVaultTabChange={setActiveVaultTab}
        />

        <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'terminal' && (
            <div className="tab-pane animate-enter" style={{ display: 'grid', gridTemplateColumns: '370px 1fr', gap: '1.25rem', height: '100%' }}>
              <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0, height: '100%', overflowY: 'auto' }}>
                <RiskPanel selectedPool={selectedPool} />
                <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', margin: '0.25rem 0' }} />
                <NansenRadar selectedPool={selectedPool} pools={data?.pools || []} />
              </aside>
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
                    <AgentSettingsPanel config={neuralRateUser.state?.config ?? null} busy={neuralRateUser.busy} onSave={neuralRateUser.saveConfig} />
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
          NeuralRate MCP • Yield Intelligence Terminal + Optional Vault Automation • Mantle Sepolia
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
