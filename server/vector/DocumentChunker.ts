export interface ChunkResult {
  text: string;
  index: number;
}

/**
 * Splits text into overlapping chunks with sentence-boundary awareness.
 * Deterministic: same input always produces the same chunks.
 */
export function chunkText(
  text: string,
  chunkSize: number,
  overlap: number,
): ChunkResult[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= chunkSize) {
    return [{ text: trimmed, index: 0 }];
  }

  const chunks: ChunkResult[] = [];
  let start = 0;
  let index = 0;

  while (start < trimmed.length) {
    let end = Math.min(start + chunkSize, trimmed.length);

    // Try to break at a sentence boundary near the chunk end
    if (end < trimmed.length) {
      const window = trimmed.slice(
        Math.max(start, end - Math.floor(chunkSize * 0.2)),
        end,
      );
      const sentenceEnd = findLastSentenceEnd(window);
      if (sentenceEnd >= 0) {
        end = end - window.length + sentenceEnd + 1;
      }
    }

    const chunk = trimmed.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push({ text: chunk, index });
      index++;
    }

    const step = end - start - overlap;
    start += Math.max(step, 1);
  }

  return chunks;
}

function findLastSentenceEnd(text: string): number {
  // Look for '. ', '! ', '? ', or end-of-sentence followed by whitespace/newline
  let lastPos = -1;
  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i];
    if ((ch === '.' || ch === '!' || ch === '?') && (i === text.length - 1 || /\s/.test(text[i + 1]))) {
      lastPos = i;
      break;
    }
  }
  return lastPos;
}
