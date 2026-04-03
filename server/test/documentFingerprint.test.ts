import { describe, expect, it } from 'vitest';
import { computeFingerprint } from '../vector/DocumentFingerprint';

describe('DocumentFingerprint', () => {
  it('produces a consistent SHA-256 hex digest', () => {
    const input = {
      id: 42,
      title: 'Test Doc',
      content: 'Some content here.',
      created: '2024-01-15T00:00:00Z',
      modified: '2024-06-01T12:00:00Z',
    };

    const a = computeFingerprint(input);
    const b = computeFingerprint(input);

    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when content changes', () => {
    const base = {
      id: 1,
      title: 'Doc',
      content: 'Version 1',
      created: '2024-01-01',
      modified: undefined,
    };

    const original = computeFingerprint(base);
    const updated = computeFingerprint({ ...base, content: 'Version 2' });

    expect(original).not.toBe(updated);
  });

  it('changes when title changes', () => {
    const base = {
      id: 1,
      title: 'Title A',
      content: 'Same',
      created: '2024-01-01',
      modified: undefined,
    };

    const a = computeFingerprint(base);
    const b = computeFingerprint({ ...base, title: 'Title B' });

    expect(a).not.toBe(b);
  });

  it('changes when modified date changes', () => {
    const base = {
      id: 1,
      title: 'Doc',
      content: 'Content',
      created: '2024-01-01',
      modified: '2024-02-01',
    };

    const a = computeFingerprint(base);
    const b = computeFingerprint({ ...base, modified: '2024-03-01' });

    expect(a).not.toBe(b);
  });

  it('handles undefined modified date', () => {
    const input = {
      id: 1,
      title: 'Doc',
      content: 'Content',
      created: '2024-01-01',
      modified: undefined,
    };

    const result = computeFingerprint(input);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it('uses null-byte delimiters to avoid ambiguity', () => {
    // These should differ because null-byte separates fields
    const a = computeFingerprint({
      id: 1,
      title: 'ab',
      content: 'cd',
      created: '2024-01-01',
      modified: undefined,
    });
    const b = computeFingerprint({
      id: 1,
      title: 'abc',
      content: 'd',
      created: '2024-01-01',
      modified: undefined,
    });

    expect(a).not.toBe(b);
  });
});
