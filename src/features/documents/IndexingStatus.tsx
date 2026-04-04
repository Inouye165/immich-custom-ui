import { useState, useEffect, useCallback } from 'react';
import type { IndexingSummary, DocumentIndexingRecord, BatchResult } from '../../types';
import type { IndexingStatusService } from '../../services/IndexingStatusService';
import styles from './IndexingStatus.module.css';

interface IndexingStatusProps {
  service: IndexingStatusService;
  pollIntervalMs?: number;
}

const STATUS_BADGE: Record<string, string> = {
  pending: styles.badgePending,
  'in-progress': styles.badgeInProgress,
  indexed: styles.badgeIndexed,
  failed: styles.badgeFailed,
  'rate-limited': styles.badgeRateLimited,
};

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function IndexingStatus({ service, pollIntervalMs = 30_000 }: IndexingStatusProps) {
  const [summary, setSummary] = useState<IndexingSummary | null>(null);
  const [records, setRecords] = useState<DocumentIndexingRecord[]>([]);
  const [showRecords, setShowRecords] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [lastBatchResult, setLastBatchResult] = useState<BatchResult | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await service.getSummary();
      setSummary(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load indexing status.');
    } finally {
      setLoading(false);
    }
  }, [service]);

  const fetchRecords = useCallback(async () => {
    try {
      const data = await service.getRecords(100, 0);
      setRecords(data.records);
    } catch {
      // Non-critical — summary is enough
    }
  }, [service]);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchSummary, pollIntervalMs]);

  useEffect(() => {
    if (showRecords) {
      fetchRecords();
    }
  }, [showRecords, fetchRecords]);

  const handleTriggerBatch = async () => {
    setTriggering(true);
    setLastBatchResult(null);
    try {
      const result = await service.triggerBatch();
      setLastBatchResult(result);
      await fetchSummary();
      if (showRecords) await fetchRecords();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Batch trigger failed.');
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <p className={styles.loading}>Loading indexing status…</p>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className={styles.container}>
        <p className={styles.error}>{error}</p>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <section className={styles.container} aria-label="Indexing status">
      <div className={styles.header}>
        <h3 className={styles.title}>Document Indexing</h3>
        <div className={styles.actions}>
          <button
            className={styles.triggerButton}
            disabled={triggering}
            onClick={handleTriggerBatch}
            type="button"
          >
            {triggering ? 'Running…' : 'Run Batch'}
          </button>
        </div>
      </div>

      <div className={styles.stats}>
        {summary.indexed > 0 && (
          <span className={`${styles.stat} ${styles.statIndexed}`}>
            <span className={styles.statCount}>{summary.indexed}</span> indexed
          </span>
        )}
        {summary.pending > 0 && (
          <span className={`${styles.stat} ${styles.statPending}`}>
            <span className={styles.statCount}>{summary.pending}</span> pending
          </span>
        )}
        {summary.inProgress > 0 && (
          <span className={`${styles.stat} ${styles.statInProgress}`}>
            <span className={styles.statCount}>{summary.inProgress}</span> in progress
          </span>
        )}
        {summary.failed > 0 && (
          <span className={`${styles.stat} ${styles.statFailed}`}>
            <span className={styles.statCount}>{summary.failed}</span> failed
          </span>
        )}
        {summary.rateLimited > 0 && (
          <span className={`${styles.stat} ${styles.statRateLimited}`}>
            <span className={styles.statCount}>{summary.rateLimited}</span> rate-limited
          </span>
        )}
        <span className={styles.stat}>
          <span className={styles.statCount}>{summary.total}</span> total
        </span>
      </div>

      <div className={styles.batchInfo}>
        {summary.lastBatchAt && (
          <p className={styles.batchInfoItem}>
            Last batch: {formatTime(summary.lastBatchAt)}
            {summary.lastBatchResult && ` — ${summary.lastBatchResult}`}
          </p>
        )}
        {summary.nextScheduledBatch && (
          <p className={styles.batchInfoItem}>
            Next scheduled: {formatTime(summary.nextScheduledBatch)}
          </p>
        )}
      </div>

      {lastBatchResult && (
        <div className={styles.batchInfo}>
          <p className={styles.batchInfoItem}>
            Batch result: {lastBatchResult.indexed} indexed, {lastBatchResult.failed} failed
            {lastBatchResult.stoppedByRateLimit && ' (stopped by rate limit)'}
            {' '}in {(lastBatchResult.durationMs / 1000).toFixed(1)}s
          </p>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <button
        className={styles.toggleRecords}
        onClick={() => setShowRecords(!showRecords)}
        type="button"
      >
        {showRecords ? 'Hide records' : 'Show records'}
      </button>

      {showRecords && (
        <ul className={styles.recordList}>
          {records.map((rec) => (
            <li key={rec.documentId} className={styles.recordItem}>
              <span className={`${styles.statusBadge} ${STATUS_BADGE[rec.status] ?? ''}`}>
                {rec.status}
              </span>
              <span className={styles.recordTitle} title={rec.title}>
                {rec.title}
              </span>
              {rec.lastError && (
                <span className={styles.recordError} title={rec.lastError}>
                  {rec.lastError}
                </span>
              )}
            </li>
          ))}
          {records.length === 0 && (
            <li className={styles.recordItem}>No records yet.</li>
          )}
        </ul>
      )}
    </section>
  );
}
