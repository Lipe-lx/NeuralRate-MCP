import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VaultPanel from '../VaultPanel';
import VaultTelemetryPanel from '../VaultTelemetryPanel';
import type { AutomationState } from '../../lib/userState';
import type { McpAccessBundle } from '../../lib/mcpAccess';

const defaultProps = {
  state: null as AutomationState | null,
  busy: false,
  notice: null as string | null,
  error: null as string | null,
  isConnected: true,
  isCorrectChain: true,
  onConnect: vi.fn(() => Promise.resolve()),
  onSwitchChain: vi.fn(() => Promise.resolve()),
  onBootstrap: vi.fn(() => Promise.resolve({})),
  onEnableAutomation: vi.fn(() => Promise.resolve()),
  onCompleteRuntimeSetup: vi.fn(() => Promise.resolve()),
  onRevokeAutomation: vi.fn(() => Promise.resolve()),
  mcpAccessBundle: null as McpAccessBundle | null,
  onIssueMcpAccess: vi.fn(() => Promise.resolve({} as McpAccessBundle)),
  onReviewOwnership: vi.fn(),
  controlWalletLabel: 'Smart Account',
  onRefreshState: vi.fn(() => Promise.resolve({})),
  onMintMockUsdy: vi.fn(() => Promise.resolve({
    txHash: '0xMintTx',
    tokenAddress: '0xMockUsdY',
    amountToken: '100',
  })),
};

describe('VaultPanel', () => {
  it('renders wallet connection prompt when isConnected is false', () => {
    render(<VaultPanel {...defaultProps} isConnected={false} />);
    expect(screen.getByRole('button', { name: /Connect Wallet/i })).toBeInTheDocument();
  });

  it('renders switch chain prompt when isCorrectChain is false', () => {
    render(<VaultPanel {...defaultProps} isCorrectChain={false} />);
    expect(screen.getByRole('button', { name: /Switch to Mantle/i })).toBeInTheDocument();
  });

  it('renders setup guide or creation prompt when vault is null', () => {
    const mockState: AutomationState = {
      ownerEoa: '0x123',
      userId: 'user-1',
      profile: null,
      config: null,
      vault: null, // No vault created
      permissions: [],
      activePermission: null,
      sessions: [],
      activeSession: null,
      grants: [],
      activeGrant: null,
      mcpSessions: [],
      activeMcpSession: null,
      automationJobs: [],
      benchmarkJobs: [],
      automationReady: false,
    };
    render(<VaultPanel {...defaultProps} state={mockState} />);
    expect(screen.getByText(/Create User Vault/i)).toBeInTheDocument();
  });

  it('renders details grid when vault exists', () => {
    const mockState: AutomationState = {
      ownerEoa: '0x123',
      userId: 'user-1',
      profile: null,
      config: null,
      vault: {
        vault_id: 'vault-123',
        user_id: 'user-1',
        owner_eoa: '0x123',
        vault_address: '0xVaultAddress',
        vault_kind: 'default',
        vault_provider: 'safe',
        agent_scope_wallet: '0xAgentWallet',
        chain_id: 5000,
        status: 'active',
        funding_status: 'funded',
        automation_status: 'ready',
        balance_usd: '1000',
        deposit_address: '0xDepositAddress',
        last_funding_intent: null,
        ownership_acknowledged_at: '2026-06-09T00:00:00Z',
      },
      permissions: [],
      activePermission: null,
      sessions: [],
      activeSession: null,
      grants: [],
      activeGrant: null,
      mcpSessions: [],
      activeMcpSession: null,
      automationJobs: [],
      benchmarkJobs: [],
      automationReady: true,
    };
    const { container } = render(<VaultPanel {...defaultProps} state={mockState} />);
    expect(container.querySelector('.vault-primary-grid')).toBeInTheDocument();
    expect(container.querySelector('.vault-summary-card')).toBeInTheDocument();
    expect(container.querySelector('.vault-funding-grid')).toBeInTheDocument();
    expect(container.querySelectorAll('.vault-action-card')).toHaveLength(2);
    expect(container.querySelector('.vault-primary-grid .vault-mcp-card')).toBeInTheDocument();
    expect(screen.getByText(/Vault Address/i)).toBeInTheDocument();
    expect(screen.getByText('0xVaultA...ddress')).toBeInTheDocument();
    expect(screen.getByText('Deposit to Vault')).toBeInTheDocument();
    expect(screen.getByText('Mock USDY Faucet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy Address/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Funding Intent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Queue .* Demo/i })).not.toBeInTheDocument();
  });

  it('renders simplified MCP Access view and toggles advanced details', async () => {
    const mockMcpAccessBundle = {
      recommendedTransport: {
        type: 'http',
        url: 'https://mcp.neuralrate.com/mcp',
        queryUrl: 'https://mcp.neuralrate.com/mcp?token=abc',
        headers: {},
      },
      ownerEoa: '0x123',
      vaultAddress: '0xVaultAddress',
      allowedDomains: ['app.neuralrate.com'],
      expiresAt: '2026-12-31T00:00:00Z',
      sessionToken: 'session-token-123456',
      catalogs: {
        execution: {
          allowed: true,
          httpUrl: 'https://mcp.neuralrate.com/mcp',
          queryHttpUrl: 'https://mcp.neuralrate.com/mcp?token=abc',
        },
        config: {
          allowed: true,
          httpUrl: 'https://mcp.neuralrate.com/config',
        },
      },
    } as any;

    const mockState: AutomationState = {
      ownerEoa: '0x123',
      userId: 'user-1',
      profile: null,
      config: null,
      vault: {
        vault_id: 'vault-123',
        user_id: 'user-1',
        owner_eoa: '0x123',
        vault_address: '0xVaultAddress',
        vault_kind: 'default',
        vault_provider: 'safe',
        agent_scope_wallet: '0xAgentWallet',
        chain_id: 5000,
        status: 'active',
        funding_status: 'funded',
        automation_status: 'ready',
        balance_usd: '1000',
        deposit_address: '0xDepositAddress',
        last_funding_intent: null,
        ownership_acknowledged_at: '2026-06-09T00:00:00Z',
      },
      permissions: [],
      activePermission: null,
      sessions: [],
      activeSession: null,
      grants: [{
        grant_id: 'g-1',
        owner_eoa: '0x123',
        user_id: 'user-1',
        vault_id: 'vault-123',
        vault_address: '0xVaultAddress',
        agent_subject: '0xAgent',
        policy_version: '1',
        allowed_domains: ['app.neuralrate.com'],
        nonce: '1',
        signature: '0xsig',
        grant_message: 'msg',
        issued_via: 'web',
        status: 'active',
        issued_at: '2026-06-09T00:00:00Z',
        expires_at: '2026-12-31T00:00:00Z',
        revoked_at: null,
        session_id: 's-1',
      }],
      activeGrant: null,
      mcpSessions: [],
      activeMcpSession: null,
      automationJobs: [],
      benchmarkJobs: [],
      automationReady: true,
    };

    mockState.activeGrant = mockState.grants[0];

    render(
      <VaultPanel
        {...defaultProps}
        state={mockState}
        mcpAccessBundle={mockMcpAccessBundle}
      />
    );

    // Verify basic details are visible
    expect(screen.getAllByText('MCP Access')).toHaveLength(1);
    expect(screen.getByText('Endpoint URL')).toBeInTheDocument();
    expect(screen.getByText('Session Token')).toBeInTheDocument();

    // Verify advanced details are NOT visible initially
    expect(screen.queryByText('MCP Type')).not.toBeInTheDocument();
    expect(screen.queryByText('Allowed Domains')).not.toBeInTheDocument();

    // Toggle advanced details
    const toggleButton = screen.getByRole('button', { name: /Show advanced connection details/i });
    await act(async () => {
      fireEvent.click(toggleButton);
    });

    // Verify advanced details are now visible
    expect(screen.getByText('MCP Type')).toBeInTheDocument();
    expect(screen.getByText('Allowed Domains')).toBeInTheDocument();
    expect(screen.getByText('x-neuralrate-session-token')).toBeInTheDocument();
  });

  it('renders Vault details and toggles technical details accordion', async () => {
    const mockState: AutomationState = {
      ownerEoa: '0x123',
      userId: 'user-1',
      profile: null,
      config: null,
      vault: {
        vault_id: 'vault-123',
        user_id: 'user-1',
        owner_eoa: '0x123',
        vault_address: '0xVaultAddress',
        vault_kind: 'default',
        vault_provider: 'safe',
        agent_scope_wallet: '0xAgentWallet',
        chain_id: 5000,
        status: 'active',
        funding_status: 'funded',
        automation_status: 'ready',
        balance_usd: '1000',
        deposit_address: '0xDepositAddress',
        last_funding_intent: null,
        ownership_acknowledged_at: '2026-06-09T00:00:00Z',
      },
      permissions: [],
      activePermission: null,
      sessions: [],
      activeSession: null,
      grants: [],
      activeGrant: null,
      mcpSessions: [],
      activeMcpSession: null,
      automationJobs: [],
      benchmarkJobs: [],
      automationReady: true,
    };

    render(<VaultPanel {...defaultProps} state={mockState} />);

    // Verify core fields are visible
    expect(screen.getByText('Vault Address')).toBeInTheDocument();
    expect(screen.getByText('Funding Status')).toBeInTheDocument();
    expect(screen.getByText('Automation')).toBeInTheDocument();

    // Verify hidden technical details are NOT visible initially
    expect(screen.queryByText('Managed Signer')).not.toBeInTheDocument();
    expect(screen.queryByText('Vault Strategy')).not.toBeInTheDocument();

    // Toggle technical details
    const toggleButton = screen.getByRole('button', { name: /Show technical details/i });
    await act(async () => {
      fireEvent.click(toggleButton);
    });

    // Verify technical details are now visible
    expect(screen.getByText('Managed Signer')).toBeInTheDocument();
    expect(screen.getByText('Vault Strategy')).toBeInTheDocument();
  });

  it('renders telemetry execution trail as a list', () => {
    const mockState: AutomationState = {
      ownerEoa: '0x123',
      userId: 'user-1',
      profile: null,
      config: {
        user_id: 'user-1',
        owner_eoa: '0x123',
        vault_id: 'vault-123',
        objective: 'income',
        risk_profile: 'medium',
        horizon_hours: 24,
        automation_mode: 'auto-within-limits',
        restriction_preset: 'rwa-focused',
        allowed_assets: ['MNT', 'mUSDY'],
        denied_assets: [],
        allowed_protocols: ['Ondo'],
        denied_protocols: [],
        max_protocol_weight_bps: 5000,
        max_asset_weight_bps: 5000,
        max_action_usd: 250,
        max_daily_usd: 500,
        max_automation_usd: 1000,
        max_slippage_bps: 50,
        rebalance_cadence_hours: 24,
        min_apy_bps: 0,
        min_spread_over_tbill_bps: 0,
        require_manual_above_usd: 500,
        pause_on_risk_event: 1,
        policy_version: '1',
      },
      vault: {
        vault_id: 'vault-123',
        user_id: 'user-1',
        owner_eoa: '0x123',
        vault_address: '0xVaultAddress',
        vault_kind: 'default',
        vault_provider: 'safe',
        agent_scope_wallet: '0xAgentWallet',
        chain_id: 5000,
        status: 'active',
        funding_status: 'funded',
        automation_status: 'ready',
        balance_usd: '1000',
        deposit_address: '0xDepositAddress',
        last_funding_intent: null,
        ownership_acknowledged_at: '2026-06-09T00:00:00Z',
      },
      permissions: [],
      activePermission: null,
      sessions: [],
      activeSession: null,
      grants: [],
      activeGrant: null,
      mcpSessions: [],
      activeMcpSession: null,
      automationJobs: [
        {
          job_id: 'job-1',
          session_id: 'session-1',
          execution_domain: 'execution',
          job_type: 'transfer_asset',
          target_contract: null,
          target_selector: null,
          payload_json: JSON.stringify({ targetAsset: 'mUSDY', protocolId: 'ondo', validationStatus: 'approved' }),
          status: 'confirmed',
          tx_hash: '0xTxHash',
          confirmed_at: '2026-06-09T01:00:00Z',
          failure_reason: null,
          created_at: '2026-06-09T00:00:00Z',
        },
      ],
      benchmarkJobs: [],
      automationReady: true,
    };

    const { container } = render(<VaultTelemetryPanel state={mockState} />);

    expect(screen.getByText('Execution Trail')).toBeInTheDocument();
    expect(container.querySelector('.vault-execution-list')).toBeInTheDocument();
    expect(container.querySelector('.vault-execution-row')).toBeInTheDocument();
    expect(screen.getByText('Transfer Asset')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });
});
