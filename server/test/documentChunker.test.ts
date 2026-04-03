import { describe, expect, it } from 'vitest';
import { chunkText } from '../vector/DocumentChunker';

describe('DocumentChunker', () => {
  it('returns the full text as a single chunk when within chunk size', () => {
    const result = chunkText('Short text.', 500, 50);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ text: 'Short text.', index: 0 });
  });

  it('returns an empty array for empty text', () => {
    expect(chunkText('', 500, 50)).toEqual([]);
  });

  it('returns an empty array for whitespace-only text', () => {
    expect(chunkText('   \n\n  ', 500, 50)).toEqual([]);
  });

  it('splits long text into multiple chunks', () => {
    const text = 'A'.repeat(300);
    const chunks = chunkText(text, 100, 20);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(100);
    }
  });

  it('assigns sequential indices', () => {
    const text = Array.from({ length: 5 }, (_, i) => `Sentence ${i}.`).join(' ');
    const chunks = chunkText(text, 20, 5);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i);
    }
  });

  it('respects sentence boundaries when possible', () => {
    const text = 'First sentence. Second sentence. Third sentence.';
    const chunks = chunkText(text, 35, 5);
    // Sentence-aware chunking should break at a period
    expect(chunks[0].text).toMatch(/\.$/);
  });

  it('handles text with no sentence boundaries', () => {
    const text = 'abcdefghijklmnop';
    const chunks = chunkText(text, 8, 2);
    expect(chunks.length).toBeGreaterThan(1);
    // All text should be covered
    const allText = chunks.map((c) => c.text).join('');
    expect(allText.length).toBeGreaterThanOrEqual(text.length);
  });

  it('produces deterministic output', () => {
    const text = 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.';
    const a = chunkText(text, 40, 10);
    const b = chunkText(text, 40, 10);
    expect(a).toEqual(b);
  });
});
