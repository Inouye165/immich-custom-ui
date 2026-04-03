import type { ArchiveFeaturedImage } from '../../types';
import styles from './ArchiveHero.module.css';

interface ArchiveHeroProps {
  featuredImages: ArchiveFeaturedImage[];
  name: string;
  onOpenEditor: () => void;
  onRenameImage: (assetId: string, caption: string) => void;
}

export function ArchiveHero({
  featuredImages,
  name,
  onOpenEditor,
  onRenameImage,
}: ArchiveHeroProps) {
  return (
    <header
      className={styles.hero}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenEditor();
      }}
    >
      <div className={styles.inner}>
        <h1 className={styles.title}>{name}</h1>

        <div className={styles.medallionRow}>
          {featuredImages.length === 0 && <span className={styles.emptyMedallion} aria-hidden="true" />}

          {featuredImages.map((image) => (
            <figure
              className={styles.medallion}
              key={image.id}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();

                const nextCaption = window.prompt(
                  'Rename this header image',
                  image.caption || image.title,
                );

                if (nextCaption === null) {
                  return;
                }

                onRenameImage(image.id, nextCaption.trim() || image.title);
              }}
              title="Right-click to rename"
            >
              <div className={styles.medallionFrame}>
                <img
                  alt={image.caption || image.title}
                  className={styles.medallionImage}
                  src={image.thumbnailUrl}
                  style={{
                    transform: `translate(${image.offsetX}%, ${image.offsetY}%) scale(${image.scale})`,
                  }}
                />
              </div>
              <figcaption>{image.caption || image.title}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </header>
  );
}