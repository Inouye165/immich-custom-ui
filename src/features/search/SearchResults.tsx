import type { SearchResult } from '../../types';
import styles from './SearchResults.module.css';

interface SearchResultsProps {
  onSelectAsset: (result: SearchResult) => void;
  results: SearchResult[];
  total: number;
}

export function SearchResults({ onSelectAsset, results, total }: SearchResultsProps) {
  return (
    <section className={styles.container} aria-label="Search results">
      <p className={styles.summary}>{total} result{total !== 1 ? 's' : ''} found</p>
      <div className={styles.grid}>
        {results.map((item) => (
          <button
            className={styles.card}
            key={item.id}
            onClick={() => onSelectAsset(item)}
            type="button"
          >
            <img
              src={item.thumbnailUrl}
              alt={item.title}
              className={styles.thumbnail}
              loading="lazy"
            />
            <div className={styles.info}>
              <h3 className={styles.title}>{item.title}</h3>
              <time className={styles.date} dateTime={item.date}>
                {new Date(item.date).toLocaleDateString()}
              </time>
              {item.description && (
                <p className={styles.description}>{item.description}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
