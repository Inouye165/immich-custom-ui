export type IndexingStatus = 'pending' | 'in-progress' | 'indexed' | 'failed' | 'rate-limited';

export interface DocumentIndexingRecord {
  documentId: number;
  title: string;
  fingerprint: string;
  status: IndexingStatus;
  totalChunks: number | null;
  completedChunks: number | null;
  retryCount: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  nextRetryAt: string | null;
}

export interface IndexingSummary {
  pending: number;
  inProgress: number;
  indexed: number;
  failed: number;
  rateLimited: number;
  total: number;
  lastBatchAt: string | null;
  lastBatchResult: string | null;
  nextScheduledBatch: string | null;
}

export interface IndexingRecordsResponse {
  records: DocumentIndexingRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface BatchResult {
  processed: number;
  indexed: number;
  skipped: number;
  failed: number;
  rateLimited: number;
  durationMs: number;
  stoppedByRateLimit: boolean;
}
