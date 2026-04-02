import { useEffect } from 'react';
import type { SearchResult } from '../../types';
import type { AssetContextResponse } from '../../types';
import { ErrorBanner } from '../../components';
import { AssetLocationMap } from './AssetLocationMap';
import styles from './AssetDetailsPanel.module.css';

interface AssetDetailsPanelProps {
  context: AssetContextResponse | null;
  errorMessage: string;
  isGeneratingSummary: boolean;
  isLoading: boolean;
  onClose: () => void;
  onGenerateSummary: () => void;
  selectedAsset: SearchResult | null;
  showAiUnavailable: boolean;
}

export function AssetDetailsPanel({
  context,
  errorMessage,
  isGeneratingSummary,
  isLoading,
  onClose,
  onGenerateSummary,
  selectedAsset,
  showAiUnavailable,
}: AssetDetailsPanelProps) {
  useEffect(() => {
    if (!selectedAsset) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, selectedAsset]);

  if (!selectedAsset) {
    return null;
  }

  const asset = context?.asset;
  const metadata = context?.metadata;
  const imageUrl = asset?.imageUrl ?? selectedAsset.thumbnailUrl;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <aside
        aria-labelledby="asset-details-title"
        aria-modal="true"
        className={styles.panel}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Asset details</p>
            <h2 className={styles.title} id="asset-details-title">
              {asset?.title ?? selectedAsset.title}
            </h2>
          </div>
          <button aria-label="Close asset details" className={styles.closeButton} onClick={onClose} type="button">
            Close
          </button>
        </header>

        <div className={styles.content}>
          <img alt={asset?.title ?? selectedAsset.title} className={styles.heroImage} src={imageUrl} />

          {errorMessage && <ErrorBanner message={errorMessage} />}

          {isLoading && <div className={styles.placeholder}>Loading photo details…</div>}

          {!isLoading && context && (
            <>
              {context.warnings.length > 0 && (
                <div className={styles.warningList} role="status">
                  {context.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              )}

              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3>Context status</h3>
                </div>
                <dl className={styles.metadataGrid}>
                  <MetadataRow label="POIs" value={formatStatus(context.status.pois)} />
                  <MetadataRow label="Weather" value={formatStatus(context.status.weather)} />
                  <MetadataRow label="AI summary" value={formatStatus(context.status.aiSummary)} />
                </dl>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3>Metadata</h3>
                  {asset?.locationLabel && <span className={styles.badge}>{asset.locationLabel}</span>}
                </div>
                <dl className={styles.metadataGrid}>
                  <MetadataRow label="Date taken" value={formatDateTime(metadata?.dateTimeOriginal ?? asset?.takenAt ?? null)} />
                  <MetadataRow label="File type" value={metadata?.fileType ?? asset?.mimeType ?? null} />
                  <MetadataRow label="Dimensions" value={formatDimensions(metadata?.width ?? null, metadata?.height ?? null)} />
                  <MetadataRow label="Camera" value={joinParts(metadata?.cameraMake ?? null, metadata?.cameraModel ?? null)} />
                  <MetadataRow label="Lens" value={metadata?.lensModel ?? null} />
                  <MetadataRow label="Exposure" value={metadata?.exposureTime ?? null} />
                  <MetadataRow label="Aperture" value={metadata?.fNumber !== null && metadata?.fNumber !== undefined ? `f/${metadata.fNumber}` : null} />
                  <MetadataRow label="ISO" value={metadata?.iso !== null && metadata?.iso !== undefined ? String(metadata.iso) : null} />
                  <MetadataRow label="GPS" value={context.gps ? formatGps(context.gps.latitude, context.gps.longitude) : 'No GPS location available'} />
                </dl>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3>Location</h3>
                  {context.gps && <span className={styles.badge}>Zoom {context.map?.zoom}</span>}
                </div>

                {!context.gps && <div className={styles.placeholder}>No GPS location available.</div>}

                {context.gps && context.map && (
                  <>
                    <AssetLocationMap center={context.map.center} pois={context.pois} zoom={context.map.zoom} />
                    <p className={styles.coordinates}>{formatGps(context.gps.latitude, context.gps.longitude)}</p>
                  </>
                )}

                <div className={styles.subSection}>
                  <h4>Nearby points of interest</h4>
                  {context.gps && context.pois.length === 0 && (
                    <div className={styles.placeholder}>No nearby points of interest found.</div>
                  )}
                  {context.pois.length > 0 && (
                    <ul className={styles.poiList}>
                      {context.pois.map((poi) => (
                        <li key={poi.id} className={styles.poiItem}>
                          <div>
                            <strong>{poi.name}</strong>
                            <p>{poi.category}</p>
                          </div>
                          <span>{poi.distanceMeters} m</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3>Weather</h3>
                  {context.weather?.weatherLabel && <span className={styles.badge}>{context.weather.weatherLabel}</span>}
                </div>
                {!context.weather && (
                  <div className={styles.placeholder}>No historical weather available for this photo.</div>
                )}
                {context.weather && (
                  <dl className={styles.metadataGrid}>
                    <MetadataRow label="Temperature" value={formatTemperature(context.weather.temperatureC, context.weather.temperatureF)} />
                    <MetadataRow label="Feels like" value={formatTemperature(context.weather.apparentTemperatureC, context.weather.apparentTemperatureF)} />
                    <MetadataRow label="Observed" value={formatDateTime(context.weather.observedAt)} />
                    <MetadataRow label="Source" value={context.weather.source} />
                  </dl>
                )}
                {context.weather?.summary && <p className={styles.supportingText}>{context.weather.summary}</p>}
              </section>

              {(context.aiSummary || context.aiSummaryAvailable) && (
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h3>About this photo</h3>
                  </div>
                  {context.aiSummary ? (
                    <p className={styles.summaryText}>{context.aiSummary}</p>
                  ) : (
                    <div className={styles.aiPrompt}>
                      <p className={styles.supportingText}>
                        Generate a grounded summary from metadata, nearby landmarks, and weather.
                      </p>
                      <button className={styles.secondaryButton} disabled={isGeneratingSummary} onClick={onGenerateSummary} type="button">
                        {isGeneratingSummary ? 'Generating…' : 'Generate summary'}
                      </button>
                      {showAiUnavailable && !isGeneratingSummary && (
                        <p className={styles.supportingText}>Summary unavailable for this photo.</p>
                      )}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value ?? 'Unavailable'}</dd>
    </>
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatDimensions(width: number | null, height: number | null) {
  if (!width || !height) {
    return null;
  }

  return `${width} × ${height}`;
}

function formatGps(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function formatTemperature(celsius: number | null, fahrenheit: number | null) {
  if (celsius === null || fahrenheit === null) {
    return null;
  }

  return `${celsius}C / ${fahrenheit}F`;
}

function joinParts(...parts: Array<string | null>) {
  const value = parts.filter(Boolean).join(' ');
  return value || null;
}

function formatStatus(value: AssetContextResponse['status'][keyof AssetContextResponse['status']]) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}