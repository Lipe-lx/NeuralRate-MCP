import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import McpConnectModal from '../McpConnectModal';

describe('McpConnectModal', () => {
  it('does not render when closed', () => {
    const { container } = render(<McpConnectModal isOpen={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders and allows toggling modes when open', async () => {
    const onClose = vi.fn();
    render(<McpConnectModal isOpen={true} onClose={onClose} />);

    // Verify title and description exist
    expect(screen.getByText('Agent Connection')).toBeInTheDocument();
    expect(screen.getByText(/NeuralRate works as a yield terminal without MCP/)).toBeInTheDocument();

    // Verify config modes buttons
    const sseButton = screen.getByRole('button', { name: /Legacy SSE/i });
    expect(sseButton).toBeInTheDocument();

    const httpButton = screen.getByRole('button', { name: /Streamable HTTP/i });
    expect(httpButton).toBeInTheDocument();

    // Toggle mode
    await act(async () => {
      fireEvent.click(sseButton);
    });

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
