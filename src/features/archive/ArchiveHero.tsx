import type { ArchiveFeaturedImage } from '../../types';
import styles from './ArchiveHero.module.css';

interface ArchiveHeroProps {
  featuredImages: ArchiveFeaturedImage[];
  name: string;
  onOpenEditor: () => void;
}

export function ArchiveHero({
  featuredImages,
  name,
  onOpenEditor,
}: ArchiveHeroProps) {
  return (
    <header
      className={styles.hero}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenEditor();
      }}
    >
      <div className={styles.patternLayer} aria-hidden="true">
        <span className={styles.sparkA} />
        <span className={styles.sparkB} />
        <span className={styles.sparkC} />
        <span className={styles.sparkD} />
      </div>

      <div className={styles.inner}>
        <h1 className={styles.title}>{name}</h1>

        <div className={styles.medallionRow}>
          {featuredImages.length === 0 && <span className={styles.emptyMedallion} aria-hidden="true" />}

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
        </div>
      </div>
    </header>
  );
}

function trimImageTitle(value: string) {
  return value.replace(/\.[^.]+$/, '');
}