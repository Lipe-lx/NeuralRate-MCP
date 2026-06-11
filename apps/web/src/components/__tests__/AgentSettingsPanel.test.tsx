import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import AgentSettingsPanel from '../AgentSettingsPanel';
import type { AgentConfig } from '../../lib/userState';

const baseConfig: AgentConfig = {
  user_id: 'user_1',
  owner_eoa: '0xowner',
  vault_id: 'vault_1',
  objective: 'income',
  risk_profile: 'medium',
  horizon_hours: 24,
  automation_mode: 'auto-within-limits',
  restriction_preset: 'blue-chip-defi',
  allowed_assets: ['USDC'],
  denied_assets: [],
  allowed_protocols: ['AAVE'],
  denied_protocols: [],
  max_protocol_weight_bps: 5000,
  max_asset_weight_bps: 5000,
  max_action_usd: 1000,
  max_daily_usd: 2500,
  max_automation_usd: 10000,
  max_slippage_bps: 50,
  rebalance_cadence_hours: 24,
  min_apy_bps: 0,
  min_spread_over_tbill_bps: 0,
  require_manual_above_usd: 2500,
  pause_on_risk_event: 1,
  policy_version: 'vault-v1',
};

const renderPanel = (props?: Partial<React.ComponentProps<typeof AgentSettingsPanel>>) => {
  const onSave = vi.fn().mockResolvedValue({});
  const onPublishPolicy = vi.fn().mockResolvedValue({});
  render(
    <AgentSettingsPanel
      config={baseConfig}
      busy={false}
      onSave={onSave}
      onPublishPolicy={onPublishPolicy}
      policySyncStatus="in_sync"
      {...props}
    />
  );
  return { onSave, onPublishPolicy };
};

describe('AgentSettingsPanel policy limits', () => {
  it('saves maxActionUsd and maxDailyUsd from visible policy controls', async () => {
    const { onSave } = renderPanel();

    fireEvent.change(screen.getByLabelText('Per Action (USD)'), { target: { value: '750' } });
    fireEvent.change(screen.getByLabelText('Daily Limit (USD)'), { target: { value: '2200' } });
    fireEvent.click(screen.getByText('Save Agent Settings'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      maxActionUsd: 750,
      maxDailyUsd: 2200,
    }));
  });

  it('shows Publish Policy when policy sync status needs owner publish', () => {
    const { rerender } = render(
      <AgentSettingsPanel
        config={baseConfig}
        busy={false}
        onSave={vi.fn()}
        onPublishPolicy={vi.fn()}
        policySyncStatus="drifted"
      />
    );

    expect(screen.getByText('Publish Policy')).toBeInTheDocument();
    expect(screen.getByText('Drifted')).toBeInTheDocument();

    rerender(
      <AgentSettingsPanel
        config={baseConfig}
        busy={false}
        onSave={vi.fn()}
        onPublishPolicy={vi.fn()}
        policySyncStatus="pending_publish"
      />
    );
    expect(screen.getByText('Publish Policy')).toBeInTheDocument();
    expect(screen.getByText('Needs publish')).toBeInTheDocument();

    rerender(
      <AgentSettingsPanel
        config={baseConfig}
        busy={false}
        onSave={vi.fn()}
        onPublishPolicy={vi.fn()}
        policySyncStatus="in_sync"
      />
    );
    expect(screen.queryByText('Publish Policy')).not.toBeInTheDocument();
    expect(screen.getByText('In sync')).toBeInTheDocument();
  });

  it('blocks invalid policy limits before saving', async () => {
    const { onSave } = renderPanel();

    fireEvent.change(screen.getByLabelText('Per Action (USD)'), { target: { value: '3000' } });
    fireEvent.change(screen.getByLabelText('Daily Limit (USD)'), { target: { value: '1000' } });
    fireEvent.click(screen.getByText('Save Agent Settings'));

    expect(await screen.findByText('Per Action must be less than or equal to Daily Limit.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
