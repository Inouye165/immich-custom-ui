import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { IndexingStatus } from '../features/documents/IndexingStatus';
import type { IndexingStatusService } from '../services/IndexingStatusService';
import type { IndexingSummary, IndexingRecordsResponse, BatchResult } from '../types';

const MOCK_SUMMARY: IndexingSummary = {
  pending: 3,
  inProgress: 1,
  indexed: 42,
  failed: 2,
  rateLimited: 1,
  total: 49,
  lastBatchAt: '2025-01-01T00:00:00.000Z',
  lastBatchResult: 'Batch complete. Indexed: 5',
  nextScheduledBatch: '2025-01-01T00:15:00.000Z',
};

const MOCK_RECORDS: IndexingRecordsResponse = {
  records: [
    {
      documentId: 1,
      title: 'Tax Return 2024',
      fingerprint: 'fp1',
      status: 'indexed',
      retryCount: 0,
      lastAttemptAt: null,
      lastSuccessAt: '2025-01-01T00:00:00.000Z',
      lastError: null,
      nextRetryAt: null,
    },
    {
      documentId: 2,
      title: 'Failed Doc',
      fingerprint: 'fp2',
      status: 'failed',
      retryCount: 3,
      lastAttemptAt: '2025-01-01T00:05:00.000Z',
      lastSuccessAt: null,
      lastError: 'Connection timeout',
      nextRetryAt: null,
    },
  ],
  total: 2,
  limit: 100,
  offset: 0,
};

function createMockService(overrides: Partial<IndexingStatusService> = {}): IndexingStatusService {
  return {
    getSummary: vi.fn().mockResolvedValue(MOCK_SUMMARY),
    getRecords: vi.fn().mockResolvedValue(MOCK_RECORDS),
    triggerBatch: vi.fn().mockResolvedValue({
      processed: 3,
      indexed: 2,
      skipped: 0,
      failed: 1,
      rateLimited: 0,
      durationMs: 1234,
      stoppedByRateLimit: false,
    } satisfies BatchResult),
    ...overrides,
  };
}

describe('IndexingStatus', () => {
  it('renders loading state initially', () => {
    const service = createMockService({
      getSummary: vi.fn().mockReturnValue(new Promise(() => {})),
    });
    render(<IndexingStatus service={service} />);
    expect(screen.getByText('Loading indexing status…')).toBeInTheDocument();
  });

  it('renders summary stats after loading', async () => {
    const service = createMockService();
    render(<IndexingStatus service={service} />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
    expect(screen.getByText('indexed')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('49')).toBeInTheDocument();
    expect(screen.getByText('total')).toBeInTheDocument();
  });

  it('renders error state when summary fetch fails', async () => {
    const service = createMockService({
      getSummary: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    render(<IndexingStatus service={service} />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows records when "Show records" is clicked', async () => {
    const user = userEvent.setup();
    const service = createMockService();
    render(<IndexingStatus service={service} />);

    await waitFor(() => {
      expect(screen.getByText('Show records')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Show records'));

    await waitFor(() => {
      expect(screen.getByText('Tax Return 2024')).toBeInTheDocument();
      expect(screen.getByText('Failed Doc')).toBeInTheDocument();
    });
    expect(service.getRecords).toHaveBeenCalled();
  });

  it('hides records when "Hide records" is clicked', async () => {
    const user = userEvent.setup();
    const service = createMockService();
    render(<IndexingStatus service={service} />);

    await waitFor(() => {
      expect(screen.getByText('Show records')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Show records'));
    await waitFor(() => {
      expect(screen.getByText('Hide records')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Hide records'));
    expect(screen.queryByText('Tax Return 2024')).not.toBeInTheDocument();
  });

  it('triggers batch run on button click', async () => {
    const user = userEvent.setup();
    const service = createMockService();
    render(<IndexingStatus service={service} />);

    await waitFor(() => {
      expect(screen.getByText('Run Batch')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Run Batch'));

    await waitFor(() => {
      expect(service.triggerBatch).toHaveBeenCalled();
    });

    // Should show batch result
    await waitFor(() => {
      expect(screen.getByText(/2 indexed/)).toBeInTheDocument();
    });
  });

  it('renders last batch info', async () => {
    const service = createMockService();
    render(<IndexingStatus service={service} />);

    await waitFor(() => {
      expect(screen.getByText(/Batch complete\. Indexed: 5/)).toBeInTheDocument();
    });
  });

  it('shows error details for failed records', async () => {
    const user = userEvent.setup();
    const service = createMockService();
    render(<IndexingStatus service={service} />);

    await waitFor(() => {
      expect(screen.getByText('Show records')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Show records'));

    await waitFor(() => {
      expect(screen.getByText('Connection timeout')).toBeInTheDocument();
    });
  });
});
