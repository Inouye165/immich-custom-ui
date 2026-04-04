import { createHash } from 'node:crypto';

export interface FingerprintInput {
  id: number;
  title: string;
  content: string;
  created: string;
  modified?: string;
}

/**
 * Compute a stable SHA-256 fingerprint for a document.
 * Change in any field produces a new fingerprint, triggering reindex.
 */
export function computeFingerprint(doc: FingerprintInput): string {
  const hash = createHash('sha256');
  hash.update(String(doc.id));
  hash.update('\x00');
  hash.update(doc.title);
  hash.update('\x00');
  hash.update(doc.content);
  hash.update('\x00');
  hash.update(doc.created);
  hash.update('\x00');
  hash.update(doc.modified ?? '');
  return hash.digest('hex');
}
