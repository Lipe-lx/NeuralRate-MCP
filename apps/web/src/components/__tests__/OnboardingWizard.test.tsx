import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OnboardingWizard from '../OnboardingWizard';

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  busy: false,
  vault: null as any,
  hasFundingIntent: false,
  onBootstrap: vi.fn(() => Promise.resolve({})),
  onFundingIntent: vi.fn(() => Promise.resolve()),
  controlWalletLabel: 'Smart Account',
};

describe('OnboardingWizard', () => {
  it('does not render when closed', () => {
    const { container } = render(<OnboardingWizard {...defaultProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders Step 1 elements and allows navigation to Step 2', async () => {
    render(<OnboardingWizard {...defaultProps} />);

    // Step 1: Welcome
    expect(screen.getByText('Initialize Your Smart Vault')).toBeInTheDocument();
    const nextButton = screen.getByRole('button', { name: /Next/i });
    expect(nextButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(nextButton);
    });

    // Step 2: Deploy Smart Account should be active
    expect(screen.getByText('Deploy Smart Account')).toBeInTheDocument();
  });

  it('triggers onBootstrap when clicking Create User Vault in Step 2', async () => {
    const onBootstrapMock = vi.fn(() => Promise.resolve({}));
    render(<OnboardingWizard {...defaultProps} onBootstrap={onBootstrapMock} />);

    // Go to step 2
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    });

    const createButton = screen.getByRole('button', { name: 'Create User Vault' });
    await act(async () => {
      fireEvent.click(createButton);
    });

    expect(onBootstrapMock).toHaveBeenCalled();
  });

  it('automatically advances to step 3 when vault is created, and allows funding intent', async () => {
    const onFundingIntentMock = vi.fn(() => Promise.resolve());
    const { rerender } = render(
      <OnboardingWizard {...defaultProps} onFundingIntent={onFundingIntentMock} />
    );

    // Go to step 2
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    });

    // Mock vault creation by updating props
    rerender(
      <OnboardingWizard
        {...defaultProps}
        vault={{ vault_address: '0x123' }}
        onFundingIntent={onFundingIntentMock}
      />
    );

    // Should automatically advance to Step 3: Set Funding Intent
    expect(screen.getByText('Set Funding Intent')).toBeInTheDocument();

    const fundingConfirmButton = screen.getByRole('button', { name: 'Confirm Funding Intent' });
    await act(async () => {
      fireEvent.click(fundingConfirmButton);
    });

    expect(onFundingIntentMock).toHaveBeenCalledWith(1000);
  });
});
