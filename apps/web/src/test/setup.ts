import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
    readText: vi.fn().mockImplementation(() => Promise.resolve('')),
  },
  writable: true,
});

// Mock window.scrollTo
window.scrollTo = vi.fn();
