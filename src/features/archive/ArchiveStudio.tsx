import type { ArchiveFeaturedImage } from '../../types';
import styles from './ArchiveStudio.module.css';

interface ArchiveStudioProps {
  featuredImages: ArchiveFeaturedImage[];
  name: string;
  onArchiveNameChange: (value: string) => void;
  onClose: () => void;
  onRemoveImage: (assetId: string) => void;
  onUpdateImage: (assetId: string, update: Partial<ArchiveFeaturedImage>) => void;
}

export function ArchiveStudio({
  featuredImages,
  name,
  onArchiveNameChange,
  onClose,
  onRemoveImage,
  onUpdateImage,
}: ArchiveStudioProps) {
  return (
    <section className={styles.studio} aria-label="Archive studio">
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>Archive studio</p>
          <h2>Shape the masthead</h2>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.badge}>{featuredImages.length} selected</span>
          <button className={styles.closeButton} onClick={onClose} type="button">
            Done
          </button>
        </div>
      </div>

      <label className={styles.nameField}>
        <span>Archive name</span>
        <input
          maxLength={60}
          onChange={(event) => onArchiveNameChange(event.target.value)}
          type="text"
          value={name}
        />
      </label>

      <p className={styles.instructions}>Adjust each image with scale and position controls.</p>

      {featuredImages.length === 0 && (
        <div className={styles.emptyState}>Choose a search result to place it in the header.</div>
      )}

      <div className={styles.editorList}>
        {featuredImages.map((image) => (
          <article className={styles.editorCard} key={image.id}>
            <div className={styles.editorHeader}>
              <div className={styles.previewFrame}>
                <img
                  alt={image.title}
                  src={image.thumbnailUrl}
                  style={{
                    transform: `translate(${image.offsetX}%, ${image.offsetY}%) scale(${image.scale})`,
                  }}
                />
              </div>
              <div className={styles.editorMeta}>
                <div>
                  <h3>{image.caption || image.title}</h3>
                  <p className={styles.sourceName}>Immich name: {image.title}</p>
                </div>
                <button onClick={() => onRemoveImage(image.id)} type="button">
                  Remove
                </button>
              </div>
            </div>

            <SliderRow
              label="Scale"
              max={2.4}
              min={1}
              onChange={(value) => onUpdateImage(image.id, { scale: value })}
              step={0.05}
              value={image.scale}
            />
            <SliderRow
              label="Move left/right"
              max={45}
              min={-45}
              onChange={(value) => onUpdateImage(image.id, { offsetX: value })}
              step={1}
              value={image.offsetX}
            />
            <SliderRow
              label="Move up/down"
              max={45}
              min={-45}
              onChange={(value) => onUpdateImage(image.id, { offsetY: value })}
              step={1}
              value={image.offsetY}
            />
          </article>
        ))}
      </div>
    </section>
  );
}

function SliderRow({
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}) {
  return (
    <label className={styles.sliderRow}>
      <span>{label}</span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
      <strong>{value}</strong>
    </label>
  );
}