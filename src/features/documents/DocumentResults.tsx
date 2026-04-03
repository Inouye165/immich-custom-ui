import type { DocumentResult } from '../../types';
import styles from './DocumentResults.module.css';

interface DocumentResultsProps {
  results: DocumentResult[];
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
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
  onLoadMore,
}: DocumentResultsProps) {
  return (
    <section className={styles.container} aria-label="Document results">
      <div className={styles.summaryRow}>
        <p className={styles.summary}>
          <span className={styles.summaryCount}>{total}</span> document{total !== 1 ? 's' : ''} found
        </p>
      </div>

      <div className={styles.grid}>
        {results.map((doc) => (
          <a
            key={doc.id}
            className={styles.card}
            href={doc.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open preview of ${doc.title}`}
          >
            <div className={styles.thumbnailWrap}>
              <img
                src={doc.thumbnailUrl}
                alt=""
                className={styles.thumbnail}
                loading="lazy"
              />
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
