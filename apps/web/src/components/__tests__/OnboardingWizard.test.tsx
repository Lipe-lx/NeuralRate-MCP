import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OnboardingWizard from '../OnboardingWizard';
import type { AutomationState } from '../../lib/userState';

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  busy: false,
  state: {
    ownerEoa: '0x123',
    userId: 'user-1',
    profile: null,
    config: null,
    vault: null,
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
  } as AutomationState | null,
  onBootstrap: vi.fn(() => Promise.resolve({})),
  onEnableAutomation: vi.fn(() => Promise.resolve()),
  onCompleteRuntimeSetup: vi.fn(() => Promise.resolve()),
  onQueueDemoStrategy: vi.fn(() => Promise.resolve()),
  isConnected: true,
  isCorrectChain: true,
  onConnect: vi.fn(() => Promise.resolve()),
  onSwitchChain: vi.fn(() => Promise.resolve()),
  runtimeProgressStep: null,
  runtimeProgressStatus: null,
};

describe('OnboardingWizard', () => {
  it('does not render when closed', () => {
    const { container } = render(<OnboardingWizard {...defaultProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders vault initialization, records ownership review, and triggers onBootstrap', async () => {
    const onBootstrapMock = vi.fn(() => Promise.resolve({}));
    render(<OnboardingWizard {...defaultProps} onBootstrap={onBootstrapMock} />);

    expect(screen.getByText('Initialize Your Smart Vault')).toBeInTheDocument();
    
    const createButton = screen.getByRole('button', { name: 'Create User Vault' });
    expect(createButton).toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox'));
    });
    expect(createButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(createButton);
    });

    expect(onBootstrapMock).toHaveBeenCalledWith({
      ownershipAcknowledgedAt: expect.any(String),
    });
  });

  it('renders Step 1 (Connect Wallet) when isConnected is false', async () => {
    const onConnectMock = vi.fn(() => Promise.resolve());
    render(<OnboardingWizard {...defaultProps} isConnected={false} onConnect={onConnectMock} />);

    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
    
    const connectButton = screen.getByRole('button', { name: 'Connect Wallet' });
    await act(async () => {
      fireEvent.click(connectButton);
    });

    expect(onConnectMock).toHaveBeenCalled();
  });

  it('renders Step 2 (Switch Network) when isConnected is true but isCorrectChain is false', async () => {
    const onSwitchChainMock = vi.fn(() => Promise.resolve());
    render(<OnboardingWizard {...defaultProps} isConnected={true} isCorrectChain={false} onSwitchChain={onSwitchChainMock} />);

    expect(screen.getByText('Switch to Mantle')).toBeInTheDocument();
    
    const switchButton = screen.getByRole('button', { name: 'Switch to Mantle Sepolia' });
    await act(async () => {
      fireEvent.click(switchButton);
    });

    expect(onSwitchChainMock).toHaveBeenCalled();
  });

  it('skips separate ownership and funding gates once a vault exists', async () => {
    const mockState: AutomationState = {
      ...defaultProps.state!,
      vault: {
        vault_id: 'vault-123',
        user_id: 'user-1',
        owner_eoa: '0x123',
        vault_address: '0xVaultAddress',
        vault_kind: 'default',
        vault_provider: 'safe',
        agent_scope_wallet: '0xAgent',
        chain_id: 5000,
        status: 'active',
        funding_status: 'not-created',
        automation_status: 'inactive',
        balance_usd: '0',
        deposit_address: '0xDepositAddress',
        last_funding_intent: null,
        ownership_acknowledged_at: null,
      },
    };

    render(
      <OnboardingWizard
        {...defaultProps}
        state={mockState}
      />
    );

    expect(screen.getByText('Enable Vault Automation')).toBeInTheDocument();
    expect(screen.queryByText('Review & Confirm Ownership')).not.toBeInTheDocument();
    expect(screen.queryByText('Set Funding Intent')).not.toBeInTheDocument();
  });

  it('renders the guided authorization flow and triggers the canonical automation callback', async () => {
    const onEnableAutomationMock = vi.fn(() => Promise.resolve());

    const mockState: AutomationState = {
      ...defaultProps.state!,
      vault: {
        vault_id: 'vault-123',
        user_id: 'user-1',
        owner_eoa: '0x123',
        vault_address: '0xVaultAddress',
        vault_kind: 'default',
        vault_provider: 'safe',
        agent_scope_wallet: '0xAgent',
        chain_id: 5000,
        status: 'active',
        funding_status: 'not-created',
        automation_status: 'inactive',
        balance_usd: '0',
        deposit_address: '0xDepositAddress',
        last_funding_intent: { amountUsd: 1000 },
        ownership_acknowledged_at: '2026-06-09T00:00:00Z',
      },
    };

    render(
      <OnboardingWizard
        {...defaultProps}
        state={mockState}
        onEnableAutomation={onEnableAutomationMock}
      />
    );

    expect(screen.getByText('Enable Vault Automation')).toBeInTheDocument();
    expect(screen.getByText('One guided approval flow')).toBeInTheDocument();
    expect(screen.getByText('Agent authorization package')).toBeInTheDocument();

    const publishButton = screen.getByRole('button', { name: 'Authorize Agent' });
    await act(async () => {
      fireEvent.click(publishButton);
    });

    expect(onEnableAutomationMock).toHaveBeenCalled();
  });
});
