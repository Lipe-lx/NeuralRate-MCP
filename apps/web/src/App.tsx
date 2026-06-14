import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import YieldScanner from './components/YieldScanner';
import RiskPanel from './components/RiskPanel';
import NansenRadar from './components/NansenRadar';
import DecisionLedger from './components/DecisionLedger';
import VaultPanel from './components/VaultPanel';
import VaultTelemetryPanel from './components/VaultTelemetryPanel';
import AgentSettingsPanel from './components/AgentSettingsPanel';
import WalletOwnershipModal from './components/WalletOwnershipModal';
import OnboardingWizard from './components/OnboardingWizard';
import VerifyPanel from './components/VerifyPanel';
import HomePanel from './components/HomePanel';
import McpConnectModal from './components/McpConnectModal';
import { useApi } from './hooks/useApi';
import { WalletProvider } from './context/WalletContext';
import { useWalletContext } from './context/WalletContext';
import { useNeuralRateUser } from './hooks/useNeuralRateUser';
import { API_BASE_URL, ENV_PROFILE } from './config';
import { mintMockUsdyToVault } from './lib/mockUsdy';

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
  const [activeVaultTab, setActiveVaultTab] = useState<'vault' | 'telemetry' | 'settings' | 'history'>('vault');
  const [isOwnershipModalOpen, setIsOwnershipModalOpen] = useState(false);
  const [isAgentAccessModalOpen, setIsAgentAccessModalOpen] = useState(false);
  const [isOnboardingWizardOpen, setIsOnboardingWizardOpen] = useState(false);
  const [wizardDismissed, setWizardDismissed] = useState(false);
  const [nansenFlows, setNansenFlows] = useState<Record<string, number>>({});
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
  const handleMintMockUsdy = useCallback(async (amountToken: string) => {
    if (!address) {
      throw new Error('Connect a wallet before minting Mock USDY.');
    }
    if (!isCorrectChain) {
      await switchToMantle();
    }
    const vaultAddress = neuralRateUser.state?.vault?.vault_address ?? neuralRateUser.state?.vault?.deposit_address;
    if (!vaultAddress) {
      throw new Error('Create a vault before minting Mock USDY.');
    }

    const provider = await wallet.getEthereumProvider();
    const result = await mintMockUsdyToVault({
      provider,
      from: address,
      vaultAddress,
      amountToken,
    });
    await neuralRateUser.refresh();
    return result;
  }, [address, isCorrectChain, neuralRateUser, switchToMantle, wallet]);

  const vault = neuralRateUser.state?.vault;
  const hasAutomation = Boolean(neuralRateUser.state?.activeGrant && neuralRateUser.state.activeGrant.status === 'active');

  const isPending = useMemo(() => {
    if (!isConnected) return true;
    if (!isCorrectChain) return true;
    if (!neuralRateUser.state) return true;
    const isVaultCreated = Boolean(vault);
    const isGrantActive = hasAutomation;
    const automationReady = Boolean(neuralRateUser.state.automationReady);

    return !isVaultCreated || !isGrantActive || !automationReady;
  }, [isConnected, isCorrectChain, neuralRateUser.state, vault, hasAutomation, neuralRateUser.state?.automationReady]);

  useEffect(() => {
    if (
      activeTab === 'vault' &&
      activeVaultTab === 'vault' &&
      isPending &&
      !wizardDismissed
    ) {
      setIsOnboardingWizardOpen(true);
    } else {
      setIsOnboardingWizardOpen(false);
    }
  }, [
    activeTab,
    activeVaultTab,
    isPending,
    wizardDismissed,
  ]);

  useEffect(() => {
    setWizardDismissed(false);
  }, [address]);

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
    return pools.find((pool) => pool.symbol === 'USDY') ?? pools[0] ?? null;
  }, [pools, selectedPoolId]);

  const controlWalletAddress = wallet.embeddedWalletAddress ?? wallet.address;
  const controlWalletLabel = wallet.embeddedWalletAddress
    ? 'Control Wallet (Embedded)'
    : wallet.address
      ? 'Control Wallet'
      : 'Control Wallet';

  const handleBootstrap = async (options?: { ownershipAcknowledgedAt?: string | null }) => {
    const nextState = await neuralRateUser.bootstrap(options);
    if (nextState?.vault?.vault_address && !nextState.vault.ownership_acknowledged_at) {
      if (wizardDismissed) {
        setIsOwnershipModalOpen(true);
      }
    }
    return nextState;
  };

  const handleAcknowledgeOwnership = async () => {
    await neuralRateUser.acknowledgeOwnership();
    setIsOwnershipModalOpen(false);
  };

  const pageTitle = useMemo(() => {
    if (route === 'home') return 'MCP Authorization and Execution for External AI Agents';
    if (route === 'docs') return 'Technical Documentation';
    if (route === 'verify') return 'Public Verification';
    return 'Operator Workspace';
  }, [route]);

  if (route === 'home') {
    return (
      <div className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header compact mcpAccessBundle={neuralRateUser.mcpAccessBundle} />
        <HomePanel onNavigate={navigateTo} mcpAccessBundle={neuralRateUser.mcpAccessBundle} />
      </div>
    );
  }

  if (route === 'docs') {
    return (
      <div className="container" style={{ minHeight: '100vh', padding: '1.25rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '1080px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Header compact mcpAccessBundle={neuralRateUser.mcpAccessBundle} />
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
          <Header compact mcpAccessBundle={neuralRateUser.mcpAccessBundle} />
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
      <aside className="opacity-100" style={{ width: '200px', flexShrink: 0, height: '100%' }}>
        <div className="sidebar-floating">
          <div className="sidebar-brand" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', padding: '1rem 0' }}>
            <div style={{
              width: '52px',
              height: '52px',
              backgroundImage: 'url(/logo.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              borderRadius: '12px',
              boxShadow: '0 0 12px var(--color-lime-glow)'
            }} />
            <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>NeuralRate</h2>
          </div>

          <nav className="sidebar-nav">
            <button className={`sidebar-nav-item ${activeTab === 'terminal' ? 'active' : ''}`} onClick={() => setActiveTab('terminal')}>
              <span>Terminal</span>
            </button>
            <button className={`sidebar-nav-item ${activeTab === 'vault' ? 'active' : ''}`} onClick={() => setActiveTab('vault')}>
              <span>Vault Automation</span>
            </button>
            <button
              className="sidebar-nav-item"
              onClick={() => setIsAgentAccessModalOpen(true)}
              title="Connect an AI agent to NeuralRate MCP"
            >
              <span>MCP Access</span>
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
          showAgentAccess={false}
          mcpAccessBundle={neuralRateUser.mcpAccessBundle}
          subtitle={activeTab === 'terminal' ? 'MCP Advisory Tools' : undefined}
        />

        <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'terminal' && (
            <div className="tab-pane animate-enter" style={{ display: 'grid', gridTemplateColumns: '370px 1fr', gap: '1.25rem', height: '100%' }}>
              <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0, height: '100%', overflowY: 'auto' }}>
                <RiskPanel selectedPool={selectedPool} nansenFlow={nansenFlows[selectedPool?.pool || ''] ?? null} />
                <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', margin: '0.25rem 0' }} />
                <NansenRadar selectedPool={selectedPool} pools={data?.pools || []} onFlowsUpdate={setNansenFlows} />
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
              <div style={{ flex: 1, minHeight: 0, overflowY: activeVaultTab === 'telemetry' ? 'hidden' : 'auto', paddingRight: '0.25rem' }}>
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
                      onEnableAutomation={neuralRateUser.enableAutomation}
                      onCompleteRuntimeSetup={neuralRateUser.completeRuntimeSetup}
                      onRevokeAutomation={neuralRateUser.revokeAutomation}
                      mcpAccessBundle={neuralRateUser.mcpAccessBundle}
                      onIssueMcpAccess={neuralRateUser.issueMcpAccessBundle}
                      onReviewOwnership={() => setIsOwnershipModalOpen(true)}
                      controlWalletLabel={controlWalletLabel}
                      onRefreshState={neuralRateUser.refresh}
                      onMintMockUsdy={handleMintMockUsdy}
                    />
                  </div>
                )}
                {activeVaultTab === 'telemetry' && (
                  <div className="centered-page-container" style={{ maxWidth: '1240px', margin: '0.65rem auto 0', height: '100%', minHeight: 0 }}>
                    <VaultTelemetryPanel state={neuralRateUser.state} />
                  </div>
                )}
                {activeVaultTab === 'settings' && (
                  <div className="centered-page-container" style={{ maxWidth: '1200px', margin: '0.65rem auto 0' }}>
                    <AgentSettingsPanel
                      config={neuralRateUser.state?.config ?? null}
                      busy={neuralRateUser.busy}
                      onSave={neuralRateUser.saveConfig}
                      onPublishPolicy={neuralRateUser.publishPolicy}
                      policySyncStatus={neuralRateUser.state?.policySyncStatus}
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

        <footer style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0, marginTop: '1rem', flexWrap: 'wrap' }}>
          <span>NeuralRate MCP • Owner-Scoped Authorization • On-Chain Policy Enforcement • Mantle Sepolia</span>
          <span>•</span>
          <a 
            href="https://github.com/Lipe-lx/NeuralRate-MCP" 
            target="_blank" 
            rel="noreferrer" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.3rem', 
              color: 'inherit', 
              textDecoration: 'none', 
              transition: 'color 0.2s' 
            }} 
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-lime)'} 
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            <span>GitHub (MIT)</span>
          </a>
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

      {isOnboardingWizardOpen && (
        <OnboardingWizard
          isOpen={isOnboardingWizardOpen}
          onClose={() => {
            setIsOnboardingWizardOpen(false);
            setWizardDismissed(true);
          }}
          busy={neuralRateUser.busy}
          state={neuralRateUser.state}
          onBootstrap={handleBootstrap}
          onEnableAutomation={neuralRateUser.enableAutomation}
          onCompleteRuntimeSetup={neuralRateUser.completeRuntimeSetup}
          isConnected={isConnected}
          isCorrectChain={isCorrectChain}
          onConnect={connect}
          onSwitchChain={switchToMantle}
          runtimeProgressStep={neuralRateUser.runtimeProgressStep}
          runtimeProgressStatus={neuralRateUser.runtimeProgressStatus}
        />
      )}

      <McpConnectModal
        isOpen={isAgentAccessModalOpen}
        onClose={() => setIsAgentAccessModalOpen(false)}
        mcpAccessBundle={neuralRateUser.mcpAccessBundle}
      />
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
