import { useRef, useEffect } from 'react';
import type { SearchResult } from '../../types';
import styles from './AlbumDraftPanel.module.css';
import searchStyles from '../search/SearchResults.module.css';

interface AlbumOption {
  id: string;
  name: string;
  photoCount: number;
}

interface AlbumDraftPanelProps {
  albums: AlbumOption[];
  hasActiveAlbum: boolean;
  isSaved: boolean;
  photos: SearchResult[];
  name: string;
  onClose: () => void;
  onCreateAlbum: () => void;
  onNameChange: (value: string) => void;
  onRemovePhoto: (id: string) => void;
  onSave: () => void;
  onSelectAlbum: (id: string) => void;
  selectedAlbumId: string;
}

export function AlbumDraftPanel({
  albums,
  hasActiveAlbum,
  isSaved,
  photos,
  name,
  onClose,
  onCreateAlbum,
  onNameChange,
  onRemovePhoto,
  onSave,
  onSelectAlbum,
  selectedAlbumId,
}: AlbumDraftPanelProps) {
  const gridEndRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(photos.length);

  useEffect(() => {
    if (photos.length > prevCountRef.current) {
      gridEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    }
    prevCountRef.current = photos.length;
  }, [photos.length]);

  return (
    <section className={styles.panel} aria-label="Album builder">
      <button className={styles.closeXButton} onClick={onClose} aria-label="Close album workspace" type="button">
        ✕
      </button>

      <div className={styles.headerShell}>
        <div className={styles.headerMeta}>
          <p className={styles.kicker}>Album Workspace</p>
          <span className={styles.badge}>
            {photos.length} photo{photos.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className={styles.albumControls}>
          <label className={styles.switcherField}>
            <span>Album</span>
            <select
              aria-label="Switch album draft"
              className={styles.draftSwitcher}
              disabled={albums.length === 0}
              onChange={(event) => onSelectAlbum(event.target.value)}
              value={selectedAlbumId}
            >
              {albums.length === 0 ? (
                <option value="">No albums yet</option>
              ) : (
                albums.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.name || 'Untitled'} ({album.photoCount})
                  </option>
                ))
              )}
            </select>
          </label>

          <button className={styles.newAlbumButton} onClick={() => onCreateAlbum()} type="button">
            + New
          </button>
        </div>
      </div>

      <input
        aria-label="Album name"
        className={styles.albumNameInput}
        disabled={!hasActiveAlbum}
        maxLength={120}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="Name your album…"
        type="text"
        value={name}
      />

      {isSaved && <p className={styles.savedState}>Album saved. Keep adding or rename to update it.</p>}

      {photos.length === 0 ? (
        <div className={styles.emptyState}>
          <svg className={styles.emptyIcon} viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect x="4" y="8" width="40" height="32" rx="6" stroke="currentColor" strokeWidth="2.5" />
            <path d="M4 32l10-10 8 8 8-12 14 14" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
            <circle cx="16" cy="18" r="3" stroke="currentColor" strokeWidth="2" />
          </svg>
          <p>
            {hasActiveAlbum
              ? <>Search on the left and each <strong>Add to Album</strong> action will copy that photo into this album.</>
              : <>Create an album, then every photo you add from the left pane will appear here.</>}
          </p>
        </div>
      ) : (
        <div className={`${searchStyles.grid} ${searchStyles.gridCompact}`}>
          {photos.map((photo) => {
            const isVideo = photo.mediaType === 'video';
            const datePart = new Date(photo.date).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const locationMatch = photo.description?.match(/•\s*(.+)/);
            const locationPart = locationMatch ? locationMatch[1].trim() : null;
            const friendlyLabel = locationPart ? `${datePart} — ${locationPart}` : datePart;

            return (
              <article className={searchStyles.card} key={photo.id}>
                <div className={searchStyles.cardButton}>
                  <div className={searchStyles.thumbnailWrap}>
                    <img alt={photo.title} className={searchStyles.thumbnail} src={photo.thumbnailUrl} />
                    <span className={`${searchStyles.mediaChip} ${isVideo ? searchStyles.videoChip : searchStyles.photoChip}`}>
                      {isVideo ? 'Video' : 'Photo'}
                    </span>
                    {isVideo && (
                      <span className={searchStyles.playOverlay} aria-label="Video">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" aria-hidden="true">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div className={searchStyles.info}>
                    <h3 className={searchStyles.title}>{friendlyLabel}</h3>
                    {photo.description && (
                      <p className={searchStyles.description}>{photo.description}</p>
                    )}
                  </div>
                </div>
                <div className={searchStyles.hoverActions}>
                  <button
                    aria-label={`Remove ${photo.title}`}
                    className={searchStyles.trashButton}
                    onClick={() => onRemovePhoto(photo.id)}
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              </article>
            );
          })}
          <div ref={gridEndRef} />
        </div>
      )}

      <button
        className={styles.saveButton}
        disabled={!hasActiveAlbum || photos.length === 0 || !name.trim()}
        onClick={onSave}
        type="button"
      >
        {isSaved ? 'Update Album' : 'Save Album'}
      </button>
    </section>
  );
}
