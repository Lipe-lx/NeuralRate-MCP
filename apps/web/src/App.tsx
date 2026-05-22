import { useState, useEffect } from 'react';

// Components
import Header from './components/Header';
import YieldScanner from './components/YieldScanner';
import RiskPanel from './components/RiskPanel';
import NansenRadar from './components/NansenRadar';
import DecisionLedger from './components/DecisionLedger';
import { useApi } from './hooks/useApi';
import { WalletProvider } from './context/WalletContext';

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
}

function AppContent() {
  const [mounted, setMounted] = useState(false);
  const { data, loading } = useApi<{ pools: Pool[] }>('/yields');
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (data?.pools?.length && !selectedPool) {
      setSelectedPool(data.pools[0]);
    }
  }, [data, selectedPool]);

  return (
    <div className="container" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className={`transition-opacity duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header />

        <main style={{ display: 'grid', gridTemplateColumns: '300px 370px 1fr', gap: '1.25rem', flex: 1, minHeight: 0, paddingBottom: '0.5rem' }}>
          {/* Left: Risk and Nansen */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0, maxHeight: '100%' }}>
            <RiskPanel selectedPool={selectedPool} />
            <NansenRadar selectedPool={selectedPool} />
          </aside>

          {/* Center: Yield Scanner */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0, maxHeight: '100%' }}>
            <YieldScanner 
              pools={data?.pools || []} 
              loading={loading} 
              onSelectPool={setSelectedPool} 
              selectedPool={selectedPool} 
            />
          </div>

          {/* Right: Decision Ledger */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0, maxHeight: '100%' }}>
            <DecisionLedger />
          </div>
        </main>

        <footer style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Powered by NeuralRate AI • Autonomous Web3 Agent • Mantle Network
        </footer>
      </div>
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
