import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { IndexingStateStore } from '../vector/IndexingStateStore';

describe('IndexingStateStore', () => {
  let tmpDir: string;
  let store: IndexingStateStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'idx-test-'));
    store = new IndexingStateStore(tmpDir);
    await store.load();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('starts with empty records', () => {
    const summary = store.getSummary();
    expect(summary.total).toBe(0);
    expect(summary.pending).toBe(0);
    expect(summary.indexed).toBe(0);
  });

  it('marks a document as pending', () => {
    store.markPending(1, 'Test Doc', 'fp-abc');
    const rec = store.getRecord(1);
    expect(rec).toBeDefined();
    expect(rec!.status).toBe('pending');
    expect(rec!.title).toBe('Test Doc');
    expect(rec!.fingerprint).toBe('fp-abc');
  });

  it('transitions through pending → in-progress → indexed', () => {
    store.markPending(1, 'Test Doc', 'fp-abc');
    store.markInProgress(1);
    expect(store.getRecord(1)!.status).toBe('in-progress');
    expect(store.getRecord(1)!.lastAttemptAt).not.toBeNull();

    store.markIndexed(1);
    expect(store.getRecord(1)!.status).toBe('indexed');
    expect(store.getRecord(1)!.lastSuccessAt).not.toBeNull();
  });

  it('transitions to failed with error message', () => {
    store.markPending(1, 'Test Doc', 'fp-abc');
    store.markFailed(1, 'Connection refused');
    const rec = store.getRecord(1)!;
    expect(rec.status).toBe('failed');
    expect(rec.lastError).toBe('Connection refused');
    expect(rec.retryCount).toBe(1);
  });

  it('transitions to rate-limited with nextRetryAt', () => {
    store.markPending(1, 'Test Doc', 'fp-abc');
    const nextRetry = new Date(Date.now() + 300_000).toISOString();
    store.markRateLimited(1, nextRetry, 'Too many requests');
    const rec = store.getRecord(1)!;
    expect(rec.status).toBe('rate-limited');
    expect(rec.nextRetryAt).toBe(nextRetry);
    expect(rec.retryCount).toBe(1);
  });

  it('returns retryable records (pending + expired rate-limited)', () => {
    store.markPending(1, 'Doc 1', 'fp1');
    store.markPending(2, 'Doc 2', 'fp2');
    store.markRateLimited(2, new Date(Date.now() - 1000).toISOString(), 'old cooldown');

    const retryable = store.getRetryableRecords();
    expect(retryable).toHaveLength(2);
    expect(retryable.map((r) => r.documentId).sort()).toEqual([1, 2]);
  });

  it('does not return rate-limited records whose cooldown has not expired', () => {
    store.markPending(1, 'Doc 1', 'fp1');
    store.markRateLimited(1, new Date(Date.now() + 300_000).toISOString(), 'future cooldown');

    const retryable = store.getRetryableRecords();
    expect(retryable).toHaveLength(0);
  });

  it('produces correct summary counts', () => {
    store.markPending(1, 'A', 'fp1');
    store.markPending(2, 'B', 'fp2');
    store.markPending(3, 'C', 'fp3');
    store.markIndexed(2);
    store.markFailed(3, 'err');

    const summary = store.getSummary();
    expect(summary.pending).toBe(1);
    expect(summary.indexed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.total).toBe(3);
  });

  it('removes a record', () => {
    store.markPending(1, 'A', 'fp1');
    store.removeRecord(1);
    expect(store.getRecord(1)).toBeUndefined();
    expect(store.getSummary().total).toBe(0);
  });

  it('persists to disk and reloads', async () => {
    store.markPending(42, 'Persisted', 'fp-persist');
    store.setLastBatch('Test run');
    await store.flush();

    const store2 = new IndexingStateStore(tmpDir);
    await store2.load();
    const rec = store2.getRecord(42);
    expect(rec).toBeDefined();
    expect(rec!.title).toBe('Persisted');
    expect(store2.getSummary().lastBatchAt).not.toBeNull();
    expect(store2.getSummary().lastBatchResult).toBe('Test run');
  });

  it('returns records sorted by status priority', () => {
    store.markPending(1, 'A', 'fp1');
    store.markPending(2, 'B', 'fp2');
    store.markPending(3, 'C', 'fp3');
    store.markPending(4, 'D', 'fp4');
    store.markInProgress(2);
    store.markIndexed(3);
    store.markFailed(4, 'err');

    const all = store.getAllRecords();
    expect(all[0].status).toBe('in-progress');
    expect(all[all.length - 1].status).toBe('indexed');
  });

  it('truncates long error messages', () => {
    store.markPending(1, 'A', 'fp1');
    store.markFailed(1, 'x'.repeat(500));
    expect(store.getRecord(1)!.lastError!.length).toBe(200);
  });

  it('gracefully handles missing file on load', async () => {
    const freshStore = new IndexingStateStore(path.join(tmpDir, 'nonexistent'));
    await freshStore.load();
    expect(freshStore.getSummary().total).toBe(0);
  });
});
