import { useCallback, useState } from 'react';
import type { DocumentResult } from '../../types';
import styles from './DocumentResults.module.css';

interface DocumentResultsProps {
  results: DocumentResult[];
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  isDeleting?: boolean;
  onLoadMore: () => void;
  onDeleteDocuments?: (ids: number[]) => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DocumentResults({
  results,
  total,
  hasMore,
  isLoadingMore,
  isDeleting = false,
  onLoadMore,
  onDeleteDocuments,
}: DocumentResultsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [failedThumbs, setFailedThumbs] = useState<Set<number>>(new Set());

  const handleThumbError = useCallback((id: number) => {
    setFailedThumbs((prev) => new Set(prev).add(id));
  }, []);

  const toggleSelect = (id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDelete = () => {
    if (selectedIds.size === 0 || !onDeleteDocuments) return;
    onDeleteDocuments([...selectedIds]);
    setSelectedIds(new Set());
  };

  return (
    <section className={styles.container} aria-label="Document results">
      <div className={styles.summaryRow}>
        <p className={styles.summary}>
          <span className={styles.summaryCount}>{total}</span> document{total !== 1 ? 's' : ''} found
        </p>
        {onDeleteDocuments && selectedIds.size > 0 && (
          <button
            className={styles.deleteButton}
            disabled={isDeleting}
            onClick={handleDelete}
            type="button"
          >
            {isDeleting ? 'Deleting…' : `Delete ${selectedIds.size} selected`}
          </button>
        )}
      </div>

      <div className={styles.grid}>
        {results.map((doc) => (
          <div key={doc.id} className={`${styles.card} ${selectedIds.has(doc.id) ? styles.cardSelected : ''}`}>
            {onDeleteDocuments && (
              <label className={styles.selectOverlay}>
                <input
                  type="checkbox"
                  className={styles.selectCheckbox}
                  checked={selectedIds.has(doc.id)}
                  onChange={() => toggleSelect(doc.id)}
                  aria-label={`Select ${doc.title}`}
                />
              </label>
            )}
            <a
              className={styles.cardLink}
              href={doc.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open preview of ${doc.title}`}
            >
              <div className={styles.thumbnailWrap}>
                {failedThumbs.has(doc.id) ? (
                  <div className={styles.thumbnailFallback} aria-hidden="true">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                ) : (
                  <img
                    src={doc.thumbnailUrl}
                    alt=""
                    className={styles.thumbnail}
                    loading="lazy"
                    onError={() => handleThumbError(doc.id)}
                  />
                )}
                <span className={styles.docChip}>Document</span>
              </div>
              <div className={styles.info}>
                <h3 className={styles.title}>{doc.title}</h3>
                <time className={styles.date} dateTime={doc.createdDate}>
                  {formatDate(doc.createdDate)}
                </time>
                {doc.snippet && (
                  <p className={styles.snippet}>{doc.snippet}</p>
                )}
              </div>
            </a>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className={styles.loadMoreRow}>
          <button
            className={styles.loadMoreButton}
            disabled={isLoadingMore}
            onClick={onLoadMore}
            type="button"
          >
            {isLoadingMore ? 'Loading…' : 'Load more documents'}
          </button>
        </div>
      )}
    </section>
  );
}
