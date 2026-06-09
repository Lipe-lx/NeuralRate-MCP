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
  hasFundingIntent: false,
  onBootstrap: vi.fn(() => Promise.resolve({})),
  onFundingIntent: vi.fn(() => Promise.resolve()),
  onAcknowledgeOwnership: vi.fn(() => Promise.resolve()),
  onPublishPolicy: vi.fn(() => Promise.resolve()),
  onFinalizeGrant: vi.fn(() => Promise.resolve()),
  onCompleteRuntimeSetup: vi.fn(() => Promise.resolve()),
  onQueueDemoStrategy: vi.fn(() => Promise.resolve()),
  controlWalletLabel: 'Smart Account',
  controlWalletAddress: '0x123ControlAddress',
  canExportEmbeddedWallet: false,
  embeddedWalletRecoveryMethod: null,
  onExportEmbeddedWallet: vi.fn(() => Promise.resolve()),
  onSetEmbeddedWalletRecovery: vi.fn(() => Promise.resolve()),
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

  it('renders Step 3 (Welcome & Deploy) elements and triggers onBootstrap', async () => {
    const onBootstrapMock = vi.fn(() => Promise.resolve({}));
    render(<OnboardingWizard {...defaultProps} onBootstrap={onBootstrapMock} />);

    expect(screen.getByText('Initialize Your Smart Vault')).toBeInTheDocument();
    
    const createButton = screen.getByRole('button', { name: 'Create User Vault' });
    await act(async () => {
      fireEvent.click(createButton);
    });

    expect(onBootstrapMock).toHaveBeenCalled();
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

  it('renders Step 4 (Secure Ownership) when vault exists but not acknowledged', async () => {
    const onAcknowledgeOwnershipMock = vi.fn(() => Promise.resolve());
    
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
        onAcknowledgeOwnership={onAcknowledgeOwnershipMock}
      />
    );

    expect(screen.getByText('Review & Confirm Ownership')).toBeInTheDocument();

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    const confirmButton = screen.getByRole('button', { name: 'Acknowledge Ownership & Unlock' });
    expect(confirmButton).toBeDisabled();

    await act(async () => {
      fireEvent.click(checkbox);
    });
    expect(checkbox).toBeChecked();
    expect(confirmButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(confirmButton);
    });
    expect(onAcknowledgeOwnershipMock).toHaveBeenCalled();
  });

  it('renders Step 5 (Set Funding) and triggers onFundingIntent', async () => {
    const onFundingIntentMock = vi.fn(() => Promise.resolve());
    
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
        ownership_acknowledged_at: '2026-06-09T00:00:00Z',
      },
    };

    render(
      <OnboardingWizard
        {...defaultProps}
        state={mockState}
        hasFundingIntent={false}
        onFundingIntent={onFundingIntentMock}
      />
    );

    expect(screen.getByText('Set Funding Intent')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: 'Confirm Funding Intent' });
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    expect(onFundingIntentMock).toHaveBeenCalledWith(1000);
  });

  it('renders Step 6 (Enable Vault Automation) sub-steps and triggers callbacks', async () => {
    const onPublishPolicyMock = vi.fn(() => Promise.resolve());
    const onFinalizeGrantMock = vi.fn(() => Promise.resolve());

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
        hasFundingIntent={true}
        onPublishPolicy={onPublishPolicyMock}
        onFinalizeGrant={onFinalizeGrantMock}
      />
    );

    expect(screen.getByText('Enable Vault Automation')).toBeInTheDocument();
    expect(screen.getByText('Confirmation 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('1. Publish Execution Policy')).toBeInTheDocument();

    const publishButton = screen.getByRole('button', { name: 'Publish Policy Rules' });
    await act(async () => {
      fireEvent.click(publishButton);
    });

    expect(onPublishPolicyMock).toHaveBeenCalled();

    expect(screen.getByText('Confirmation 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('2. Authorize Agent Grant')).toBeInTheDocument();

    const signButton = screen.getByRole('button', { name: 'Sign Agent Authorization' });
    await act(async () => {
      fireEvent.click(signButton);
    });

    expect(onFinalizeGrantMock).toHaveBeenCalled();
  });
});
