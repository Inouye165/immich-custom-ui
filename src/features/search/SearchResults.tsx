import type { SearchResult } from '../../types';
import styles from './SearchResults.module.css';

interface SearchResultsProps {
  canAddMoreFeatured: boolean;
  featuredAssetIds: string[];
  isChoosingHeaderImage: boolean;
  onSelectAsset: (result: SearchResult) => void;
  onToggleFeaturedAsset: (result: SearchResult) => void;
  results: SearchResult[];
  total: number;
}

export function SearchResults({
  canAddMoreFeatured,
  featuredAssetIds,
  isChoosingHeaderImage,
  onSelectAsset,
  onToggleFeaturedAsset,
  results,
  total,
}: SearchResultsProps) {
  return (
    <section className={styles.container} aria-label="Search results">
      <p className={styles.summary}>{total} result{total !== 1 ? 's' : ''} found</p>
      <div className={styles.grid}>
        {results.map((item) => {
          const isFeatured = featuredAssetIds.includes(item.id);
          const showHeaderAction = isChoosingHeaderImage || isFeatured;
          return (
            <article className={styles.card} key={item.id}>
              <button
                aria-label={`Open details for ${item.title}`}
                className={styles.cardButton}
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
            </article>
          );
        })}
      </div>
    </section>
  );
}
