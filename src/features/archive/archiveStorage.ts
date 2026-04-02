import type { ArchiveFeaturedImage, ArchivePreferences } from '../../types';

const STORAGE_KEY = 'immich-custom-ui.archive-preferences';
export const MAX_ARCHIVE_IMAGES = 8;
export const DEFAULT_ARCHIVE_NAME = 'The Hearthside Archive';

export function loadArchivePreferences(): ArchivePreferences {
  if (typeof window === 'undefined') {
    return {
      featuredImages: [],
      name: DEFAULT_ARCHIVE_NAME,
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        featuredImages: [],
        name: DEFAULT_ARCHIVE_NAME,
      };
    }

    const parsed = JSON.parse(raw) as Partial<ArchivePreferences>;
    return {
      featuredImages: Array.isArray(parsed.featuredImages)
        ? parsed.featuredImages.filter(isArchiveImage).slice(0, MAX_ARCHIVE_IMAGES)
        : [],
      name: typeof parsed.name === 'string' && parsed.name.trim().length > 0
        ? parsed.name
        : DEFAULT_ARCHIVE_NAME,
    };
  } catch {
    return {
      featuredImages: [],
      name: DEFAULT_ARCHIVE_NAME,
    };
  }
}

export function saveArchivePreferences(preferences: ArchivePreferences) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

function isArchiveImage(value: unknown): value is ArchiveFeaturedImage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.offsetX === 'number' &&
    typeof candidate.offsetY === 'number' &&
    typeof candidate.scale === 'number' &&
    typeof candidate.thumbnailUrl === 'string' &&
    typeof candidate.title === 'string'
  );
}