import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const McpConnectModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const mcpUrl = "http://localhost:8787/sse";
  const jsonConfig = `{
  "mcpServers": {
    "stablesync": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/client-cli", "${mcpUrl}"]
    }
  }
}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Model Context Protocol (MCP) Server</div>
          </div>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          StableSync operates as a fully autonomous MCP server. AI agents can connect to this endpoint to scan yields, run risk assessments, and execute logic securely.
        </p>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>1-Click Protocol Link</div>
          <a 
            href={`mcp+sse://localhost:8787/sse`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              background: 'var(--color-lime)', color: 'var(--bg-deep)', padding: '0.75rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem', transition: 'opacity 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
            onMouseOut={e => e.currentTarget.style.opacity = '1'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            Connect Agent Automatically
          </a>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>Manual JSON Config</div>
            <button 
              onClick={handleCopy}
              style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: copied ? 'var(--color-lime)' : 'var(--text-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              {copied ? '✓ Copied!' : 'Copy JSON'}
            </button>
          </div>
          <pre style={{ margin: 0, padding: '1rem', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--color-lime)', overflowX: 'auto', fontFamily: 'monospace' }}>
            {jsonConfig}
          </pre>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default McpConnectModal;
