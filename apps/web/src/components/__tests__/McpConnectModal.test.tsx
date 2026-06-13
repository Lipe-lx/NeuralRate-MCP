import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import McpConnectModal from '../McpConnectModal';

describe('McpConnectModal', () => {
  it('does not render when closed', () => {
    const { container } = render(<McpConnectModal isOpen={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders correctly when open', async () => {
    const onClose = vi.fn();
    render(<McpConnectModal isOpen={true} onClose={onClose} />);

    expect(screen.getByText('Connect Through MCP')).toBeInTheDocument();
    expect(screen.getByText(/The public endpoint exposes read-only advisory tools/)).toBeInTheDocument();
    expect(screen.getByText('Public Read-Only Endpoint')).toBeInTheDocument();

    // Check that onClose is triggered when clicking close button
    const closeButton = screen.getByText('×');
    await act(async () => {
      fireEvent.click(closeButton);
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('handles copying endpoints', async () => {
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');
    render(<McpConnectModal isOpen={true} onClose={vi.fn()} />);

    const copyUrlButtons = screen.getAllByRole('button', { name: /Copy URL/i });
    expect(copyUrlButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(copyUrlButtons[0]);
    });

    expect(writeTextSpy).toHaveBeenCalled();
  });
});
