import type { ArchiveFeaturedImage } from '../../types';
import styles from './ArchiveHero.module.css';

interface ArchiveHeroProps {
  featuredImages: ArchiveFeaturedImage[];
  isChoosingImage: boolean;
  name: string;
  onChooseImage: () => void;
}

export function ArchiveHero({
  featuredImages,
  isChoosingImage,
  name,
  onChooseImage,
}: ArchiveHeroProps) {
  return (
    <header className={styles.hero}>
      <div className={styles.patternLayer} aria-hidden="true">
        <span className={styles.sparkA} />
        <span className={styles.sparkB} />
        <span className={styles.sparkC} />
        <span className={styles.sparkD} />
      </div>

      <div className={styles.inner}>
        <h1 className={styles.title}>{name}</h1>

        <div className={styles.medallionRow}>
          {featuredImages.length === 0 && (
            <button
              className={styles.addImageButton}
              onClick={onChooseImage}
              type="button"
            >
              {isChoosingImage ? 'Cancel' : 'Add image'}
            </button>
          )}

          {featuredImages.map((image) => (
            <figure className={styles.medallion} key={image.id}>
              <div className={styles.medallionFrame}>
                <img
                  alt={image.title}
                  className={styles.medallionImage}
                  src={image.thumbnailUrl}
                  style={{
                    transform: `translate(${image.offsetX}%, ${image.offsetY}%) scale(${image.scale})`,
                  }}
                />
              </div>
              <figcaption>{trimImageTitle(image.title)}</figcaption>
            </figure>
          ))}

          {featuredImages.length > 0 && (
            <button
              className={styles.secondaryAction}
              onClick={onChooseImage}
              type="button"
            >
              {isChoosingImage ? 'Done choosing' : 'Add image'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function trimImageTitle(value: string) {
  return value.replace(/\.[^.]+$/, '');
}