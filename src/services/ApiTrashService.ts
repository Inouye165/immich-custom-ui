import type { TrashResult, TrashService } from './TrashService';

interface ErrorResponse {
  message?: string;
}

export class ApiTrashService implements TrashService {
  async trashAssets(ids: string[]): Promise<TrashResult> {
    const response = await fetch('/api/assets/trash', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids }),
    });

    if (!response.ok) {
      const payload = (await safeParseJson(response)) as ErrorResponse | null;
      throw new Error(payload?.message?.trim() || 'Failed to move assets to trash.');
    }

    return (await response.json()) as TrashResult;
  }
}

async function safeParseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
