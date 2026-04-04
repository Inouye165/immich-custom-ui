import type { IndexingSummary, IndexingRecordsResponse, BatchResult } from '../types';

export interface IndexingStatusService {
  getSummary(): Promise<IndexingSummary>;
  getRecords(limit?: number, offset?: number): Promise<IndexingRecordsResponse>;
  triggerBatch(): Promise<BatchResult>;
}
