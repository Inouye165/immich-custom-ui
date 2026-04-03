import type { SearchResult } from '../../types';
import styles from './SearchResults.module.css';

interface SearchResultsProps {
  isAlbumWorkspaceOpen: boolean;
  canAddMoreFeatured: boolean;
  draftAlbumPhotoIds: string[];
  featuredAssetIds: string[];
  isCompactLayout: boolean;
  isChoosingHeaderImage: boolean;
  isTrashing: boolean;
  onSelectAsset: (result: SearchResult) => void;
  onToggleAlbumPhoto: (result: SearchResult) => void;
  onToggleFeaturedAsset: (result: SearchResult) => void;
  onTrashAssets: (ids: string[]) => void;
  results: SearchResult[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  total: number;
}

function formatFriendlyLabel(item: SearchResult): string {
  const datePart = new Date(item.date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const locationPart = extractLocation(item.description);
  return locationPart ? `${datePart} — ${locationPart}` : datePart;
}

function extractLocation(description?: string): string | null {
  if (!description) return null;
  const match = description.match(/•\s*(.+)/);
  return match ? match[1].trim() : null;
}

export function SearchResults({
  isAlbumWorkspaceOpen,
  canAddMoreFeatured,
  draftAlbumPhotoIds,
  featuredAssetIds,
  isCompactLayout,
  isChoosingHeaderImage,
  isTrashing,
  onSelectAsset,
  onToggleAlbumPhoto,
  onToggleFeaturedAsset,
  onTrashAssets,
  results,
  selectedIds,
  onToggleSelect,
  total,
}: SearchResultsProps) {
  const selectionCount = selectedIds.size;

  return (
    <section className={styles.container} aria-label="Search results">
      <div className={styles.summaryRow}>
        <p className={styles.summary}>
          <span className={styles.summaryCount}>{total}</span> result{total !== 1 ? 's' : ''} found
        </p>
        {selectionCount > 0 && (
          <div className={styles.batchBar} role="toolbar" aria-label="Batch actions">
            <span className={styles.batchCount}>{selectionCount} selected</span>
            <button
              className={styles.batchTrashButton}
              disabled={isTrashing}
              onClick={() => onTrashAssets(Array.from(selectedIds))}
              type="button"
            >
              {isTrashing ? 'Moving to trash…' : 'Move to trash'}
            </button>
            <button
              className={styles.batchCancelButton}
              onClick={() => {
                for (const id of selectedIds) {
                  onToggleSelect(id);
                }
              }}
              type="button"
            >
              Clear
            </button>
          </div>
        )}
      </div>
      <div className={`${styles.grid} ${isCompactLayout ? styles.gridCompact : styles.gridRegular}`}>
        {results.map((item) => {
          const isFeatured = featuredAssetIds.includes(item.id);
          const showHeaderAction = isChoosingHeaderImage;
          const isInAlbum = draftAlbumPhotoIds.includes(item.id);
          const canOpenAlbum = isInAlbum && !isAlbumWorkspaceOpen;
          const isVideo = item.mediaType === 'video';
          const isSelected = selectedIds.has(item.id);
          const friendlyLabel = formatFriendlyLabel(item);
          return (
            <article className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`} key={item.id}>
              <div className={styles.selectLayer}>
                <label className={styles.selectLabel}>
                  <input
                    aria-label={`Select ${item.title}`}
                    checked={isSelected}
                    className={styles.selectCheckbox}
                    onChange={() => onToggleSelect(item.id)}
                    type="checkbox"
                  />
                </label>
              </div>
              <button
                aria-label={`Open details for ${item.title}`}
                className={styles.cardButton}
                onClick={() => onSelectAsset(item)}
                type="button"
              >
                <div className={styles.thumbnailWrap}>
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    className={styles.thumbnail}
                    loading="lazy"
                  />
                  <span className={`${styles.mediaChip} ${isVideo ? styles.videoChip : styles.photoChip}`}>
                    {isVideo ? 'Video' : 'Photo'}
                  </span>
                  {isVideo && (
                    <span className={styles.playOverlay} aria-label="Video">
                      <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  )}
                </div>
                <div className={styles.info}>
                  <h3 className={styles.title}>{friendlyLabel}</h3>
                  {item.description && (
                    <p className={styles.description}>{item.description}</p>
                  )}
                </div>
              </button>
              <div className={styles.hoverActions}>
                <button
                  aria-label={`Move ${item.title} to trash`}
                  className={styles.trashButton}
                  disabled={isTrashing}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTrashAssets([item.id]);
                  }}
                  type="button"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </svg>
                </button>
              </div>
              {showHeaderAction && (
                <div className={styles.actions}>
                  <button
                    aria-label={isFeatured ? `Remove ${item.title} from header` : `Use ${item.title} in header`}
                    className={styles.featureButton}
                    disabled={!isFeatured && !canAddMoreFeatured}
                    onClick={() => onToggleFeaturedAsset(item)}
                    type="button"
                  >
                    {isFeatured ? 'Remove from header' : 'Use in header'}
                  </button>
                </div>
              )}
              <div className={styles.actions}>
                <button
                  aria-label={canOpenAlbum ? `Open album for ${item.title}` : isInAlbum ? `${item.title} already added to album` : `Add ${item.title} to album`}
                  className={styles.albumButton}
                  disabled={isInAlbum && isAlbumWorkspaceOpen}
                  onClick={() => onToggleAlbumPhoto(item)}
                  type="button"
                >
                  {canOpenAlbum ? 'Open Album' : isInAlbum ? 'Added to Album' : 'Add to Album'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
