import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NansenRadar from '../NansenRadar';
import type { Pool } from '../../App';

const pool: Pool = {
  symbol: 'USDC',
  project: 'test',
  apy: 5,
  tvlUsd: 1_000_000,
  pool: 'pool-1',
  apyBase: 5,
  apyReward: null,
  ilRisk: null,
  exposure: 'single',
  volumeUsd1d: null,
  volumeUsd7d: null,
  apyPct1D: null,
  apyPct7D: null,
  apyPct30D: null,
  apyMean30d: null,
  stablecoin: true,
  sigma: 0,
  underlyingTokens: ['0x1111111111111111111111111111111111111111'],
  rewardTokens: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('NansenRadar API key privacy', () => {
  it('keeps the key in component memory and sends it only with Nansen requests', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({
      status: 'success',
      fetchedAt: new Date().toISOString(),
      poolSummaries: {
        [pool.pool]: {
          poolId: pool.pool,
          symbol: pool.symbol,
          project: pool.project,
          tokenAddresses: pool.underlyingTokens,
          tokens: [],
          totalNetFlow24h: 0,
          totalNetFlow7d: 0,
          topToken: null,
          signal: 'neutral',
          cacheStatus: {},
        },
      },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const localStorageSpy = vi.spyOn(Storage.prototype, 'setItem');

    render(<NansenRadar selectedPool={pool} pools={[pool]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Enable Nansen Radar' }));
    expect(screen.getByRole('dialog', { name: 'Connect Nansen API' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Nansen API Key'), {
      target: { value: 'nansen-private-key' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enable Radar' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(requestInit.headers).toEqual(expect.objectContaining({
      'X-NeuralRate-Nansen-Api-Key': 'nansen-private-key',
    }));
    expect(requestInit.cache).toBe('no-store');
    expect(requestInit.credentials).toBe('omit');
    expect(localStorageSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Disable Nansen Radar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enable Nansen Radar' }));
    expect(screen.getByLabelText('Nansen API Key')).toHaveValue('');
  });
});
