import type { SearchResult } from '../../types';

const STORAGE_KEY = 'immich-custom-ui.album-preferences';

export interface StoredAlbumDraft {
  id: string;
  isSaved: boolean;
  name: string;
  photos: SearchResult[];
}

interface AlbumPreferences {
  activeAlbumDraftId: string | null;
  albums: StoredAlbumDraft[];
}

export function loadAlbumPreferences(): AlbumPreferences {
  if (typeof window === 'undefined') {
    return {
      activeAlbumDraftId: null,
      albums: [],
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        activeAlbumDraftId: null,
        albums: [],
      };
    }

    const parsed = JSON.parse(raw) as Partial<AlbumPreferences>;
    const albums = Array.isArray(parsed.albums)
      ? parsed.albums
          .map(normalizeAlbumDraft)
          .filter((album): album is StoredAlbumDraft => album !== null)
      : [];
    const activeAlbumDraftId =
      typeof parsed.activeAlbumDraftId === 'string' &&
      albums.some((album) => album.id === parsed.activeAlbumDraftId)
        ? parsed.activeAlbumDraftId
        : albums[0]?.id ?? null;

    return {
      activeAlbumDraftId,
      albums,
    };
  } catch {
    return {
      activeAlbumDraftId: null,
      albums: [],
    };
  }
}

export function saveAlbumPreferences(preferences: AlbumPreferences) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

function normalizeAlbumDraft(value: unknown): StoredAlbumDraft | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.isSaved !== 'boolean' ||
    !Array.isArray(candidate.photos)
  ) {
    return null;
  }

  const photos = candidate.photos
    .map(normalizeSearchResult)
    .filter((photo): photo is SearchResult => photo !== null);

  return {
    id: candidate.id,
    isSaved: candidate.isSaved,
    name: candidate.name,
    photos,
  };
}

function normalizeSearchResult(value: unknown): SearchResult | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.title !== 'string' ||
    typeof candidate.thumbnailUrl !== 'string' ||
    typeof candidate.date !== 'string'
  ) {
    return null;
  }

  return {
    date: candidate.date,
    description: typeof candidate.description === 'string' ? candidate.description : undefined,
    id: candidate.id,
    mediaType: candidate.mediaType === 'video' || candidate.mediaType === 'photo'
      ? candidate.mediaType
      : undefined,
    thumbnailUrl: candidate.thumbnailUrl,
    title: candidate.title,
  };
}