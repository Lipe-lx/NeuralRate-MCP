import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useWalletContext } from '../context/WalletContext';

const DecisionLedger: React.FC = () => {
  const { data: decisions, loading, execute: fetchDecisions } = useApi<any[]>('/decisions');
  const [allocating, setAllocating] = useState(false);
  const { address, isConnected, isCorrectChain } = useWalletContext();

  const triggerAllocation = async () => {
    setAllocating(true);
    try {
      // 1. Get optimal allocation
      const allocRes = await fetch('http://localhost:8787/api/allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUsd: 10000, riskProfile: 'medium', horizonHours: 24 })
      });
      const allocation = await allocRes.json();

      // 2. Log decision
      const decisionId = '0xdec_' + Math.random().toString(36).substr(2, 9);
      await fetch('http://localhost:8787/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisionId,
          agentAddress: address || '0x0',
          predictedApyBps: Math.round(allocation.blendedPredictedApy * 100),
          riskProfile: allocation.riskProfile,
          allocationJson: JSON.stringify(allocation.allocations),
          settlementHorizonHours: allocation.horizon
        })
      });

      // 3. Refresh decisions
      await fetchDecisions();
    } catch (e) {
      console.error(e);
    } finally {
      setAllocating(false);
    }
  };

  const clearLedger = async () => {
    try {
      await fetch('http://localhost:8787/api/decisions', { method: 'DELETE' });
      await fetchDecisions();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <section className="glass-panel animate-enter delay-400" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
        <h3 style={{ fontSize: '1.125rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          Decision Ledger
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginRight: '0.5rem' }}>
            ERC-8004 Registry
          </span>
          <button 
            onClick={clearLedger} 
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              padding: '0.4rem 0.8rem',
              borderRadius: '4px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#fff'; }}
            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
          >
            Clear
          </button>
          <button 
            onClick={triggerAllocation} 
            disabled={allocating || !isConnected || !isCorrectChain}
            style={{
              background: 'var(--color-lime)',
              color: '#000',
              border: 'none',
              padding: '0.4rem 0.8rem',
              borderRadius: '4px',
              fontWeight: 600,
              cursor: (allocating || !isConnected || !isCorrectChain) ? 'not-allowed' : 'pointer',
              opacity: (allocating || !isConnected || !isCorrectChain) ? 0.5 : 1
            }}
          >
            {allocating ? 'Simulating...' : !isConnected ? 'Connect Wallet' : !isCorrectChain ? 'Wrong Network' : 'Trigger Allocation'}
          </button>
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              <th style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>ID</th>
              <th style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>Profile</th>
              <th style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>Predicted APY</th>
              <th style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>Status</th>
              <th style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid var(--border-subtle)', borderTopColor: 'var(--color-lime)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
                </td>
              </tr>
            ) : !decisions || decisions.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-secondary)' }}>
                  No decisions logged yet. Trigger an allocation to start.
                </td>
              </tr>
            ) : (
              decisions.map((d: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-surface-elevated)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '1rem 0.5rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    {d.decision_id.substring(0, 10)}...
                  </td>
                  <td style={{ padding: '1rem 0.5rem', textTransform: 'capitalize' }}>{d.risk_profile}</td>
                  <td style={{ padding: '1rem 0.5rem', color: 'var(--color-lime)', fontWeight: 600 }}>{(d.predicted_apy_bps / 100).toFixed(2)}%</td>
                  <td style={{ padding: '1rem 0.5rem' }}>
                    <span style={{ display: 'inline-block', padding: '0.2rem 0.5rem', background: d.is_settled ? 'rgba(255, 255, 255, 0.1)' : 'rgba(223, 246, 81, 0.1)', color: d.is_settled ? 'var(--text-secondary)' : 'var(--color-lime)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                      {d.is_settled ? 'SETTLED' : 'OPEN'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    {new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default DecisionLedger;
