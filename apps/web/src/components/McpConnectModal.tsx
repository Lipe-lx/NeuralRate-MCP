import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MCP_HTTP_URL, SSE_URL } from '../config';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const McpConnectModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [configMode, setConfigMode] = useState<'http' | 'sse'>('http');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const mcpUrl = MCP_HTTP_URL;
  const sseUrl = SSE_URL;
  const streamableHttpConfig = `{
  "mcpServers": {
    "neuralrate": {
      "type": "http",
      "url": "${mcpUrl}"
    }
  }
}`;
  const legacySseConfig = `{
  "mcpServers": {
    "neuralrate": {
      "type": "sse",
      "url": "${sseUrl}"
    }
  }
}`;
  const activeConfig = configMode === 'http' ? streamableHttpConfig : legacySseConfig;

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'var(--bg-deep)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          width: '90%',
          maxWidth: '500px',
          padding: '2rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(223,246,81,0.1)',
          position: 'relative'
        }}
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.25rem' }}
        >
          ×
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ width: '40px', height: '40px', background: 'var(--bg-surface)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-lime)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="2">
              <path d="M4 11a9 9 0 0 1 9 9"></path>
              <path d="M4 4a16 16 0 0 1 16 16"></path>
              <circle cx="5" cy="19" r="1"></circle>
            </svg>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Agent Connection</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Optional MCP access for operator automation</div>
          </div>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          NeuralRate works as a yield terminal without MCP. Use this only if you want an external agent to run grant-scoped actions against your vault policy.
        </p>

        <div style={{ display: 'grid', gap: '0.85rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.9rem', background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid rgba(223,246,81,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.55rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-lime)', fontWeight: 700 }}>Recommended Endpoint</div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 600, marginTop: '0.2rem' }}>Streamable HTTP on `/mcp`</div>
              </div>
              <button
                onClick={() => handleCopy('http-url', mcpUrl)}
                style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: copiedKey === 'http-url' ? 'var(--color-lime)' : 'var(--text-secondary)', padding: '0.3rem 0.55rem', borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer' }}
              >
                {copiedKey === 'http-url' ? 'Copied URL' : 'Copy URL'}
              </button>
            </div>
            <pre style={{ margin: 0, padding: '0.85rem', background: 'rgba(0,0,0,0.18)', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.74rem', color: 'var(--color-lime)', overflowX: 'auto', fontFamily: 'monospace' }}>
              {mcpUrl}
            </pre>
            <p style={{ margin: '0.65rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Prefer this URL in modern MCP clients. Current best practice is to connect agents directly to the canonical HTTP endpoint rather than relying on a custom `mcp+sse://` app handler.
            </p>
          </div>

          <div style={{ padding: '0.9rem', background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.55rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', fontWeight: 700 }}>Compatibility Fallback</div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 600, marginTop: '0.2rem' }}>Legacy SSE on `/sse`</div>
              </div>
              <button
                onClick={() => handleCopy('sse-url', sseUrl)}
                style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: copiedKey === 'sse-url' ? 'var(--color-lime)' : 'var(--text-secondary)', padding: '0.3rem 0.55rem', borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer' }}
              >
                {copiedKey === 'sse-url' ? 'Copied URL' : 'Copy URL'}
              </button>
            </div>
            <pre style={{ margin: 0, padding: '0.85rem', background: 'rgba(0,0,0,0.18)', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.74rem', color: 'var(--text-secondary)', overflowX: 'auto', fontFamily: 'monospace' }}>
              {sseUrl}
            </pre>
            <p style={{ margin: '0.65rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Use this only for older clients that still require SSE transport. NeuralRate keeps it available as a compatibility alias.
            </p>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>Manual JSON Config</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Most clients now accept a server `url` and `type`.
              </div>
            </div>
            <button 
              onClick={() => handleCopy('json', activeConfig)}
              style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: copiedKey === 'json' ? 'var(--color-lime)' : 'var(--text-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              {copiedKey === 'json' ? '✓ Copied!' : 'Copy JSON'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setConfigMode('http')}
              style={{
                background: configMode === 'http' ? 'rgba(223,246,81,0.14)' : 'transparent',
                border: `1px solid ${configMode === 'http' ? 'rgba(223,246,81,0.35)' : 'var(--border-subtle)'}`,
                color: configMode === 'http' ? 'var(--color-lime)' : 'var(--text-secondary)',
                padding: '0.35rem 0.65rem',
                borderRadius: '999px',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Streamable HTTP (Recommended)
            </button>
            <button
              onClick={() => setConfigMode('sse')}
              style={{
                background: configMode === 'sse' ? 'rgba(223,246,81,0.08)' : 'transparent',
                border: `1px solid ${configMode === 'sse' ? 'rgba(223,246,81,0.24)' : 'var(--border-subtle)'}`,
                color: configMode === 'sse' ? 'var(--text-primary)' : 'var(--text-secondary)',
                padding: '0.35rem 0.65rem',
                borderRadius: '999px',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Legacy SSE
            </button>
          </div>
          <pre style={{ margin: 0, padding: '1rem', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--color-lime)', overflowX: 'auto', fontFamily: 'monospace' }}>
            {activeConfig}
          </pre>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default McpConnectModal;
