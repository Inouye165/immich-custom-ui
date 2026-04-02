import { useEffect, useRef, useState } from 'react';
import type { ArchiveFeaturedImage, SearchRequest, SearchResult } from './types';
import { ApiAssetContextService, ApiSearchService } from './services';
import type { AssetContextService, SearchService } from './services';
import type { AssetContextResponse } from './types';
import {
  ArchiveHero,
  ArchiveStudio,
  DEFAULT_ARCHIVE_NAME,
  MAX_ARCHIVE_IMAGES,
  loadArchivePreferences,
  saveArchivePreferences,
} from './features/archive';
import { SearchForm, SearchResults } from './features/search';
import { AssetDetailsPanel } from './features/assets';
import { EmptyState, ErrorBanner } from './components';
import styles from './App.module.css';

type SearchState = 'idle' | 'loading' | 'success' | 'error';

const defaultAssetContextService = new ApiAssetContextService();
const defaultSearchService = new ApiSearchService();

interface AppProps {
  assetContextService?: AssetContextService;
  searchService?: SearchService;
}

function App({
  assetContextService = defaultAssetContextService,
  searchService = defaultSearchService,
}: AppProps) {
  const assetRequestRef = useRef(0);
  const [archiveName, setArchiveName] = useState(
    () => loadArchivePreferences().name || DEFAULT_ARCHIVE_NAME,
  );
  const [featuredImages, setFeaturedImages] = useState<ArchiveFeaturedImage[]>(
    () => loadArchivePreferences().featuredImages,
  );
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<SearchState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [assetContext, setAssetContext] = useState<AssetContextResponse | null>(null);
  const [assetErrorMsg, setAssetErrorMsg] = useState('');
  const [isAssetLoading, setIsAssetLoading] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isChoosingHeaderImage, setIsChoosingHeaderImage] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<SearchResult | null>(null);
  const [showAiUnavailable, setShowAiUnavailable] = useState(false);

  useEffect(() => {
    saveArchivePreferences({
      featuredImages,
      name: archiveName.trim() || DEFAULT_ARCHIVE_NAME,
    });
  }, [archiveName, featuredImages]);

  const handleSearch = async (request: SearchRequest) => {
    setState('loading');
    setErrorMsg('');
    closeAssetPanel();
    try {
      const response = await searchService.search(request);
      setResults(response.results);
      setTotal(response.total);
      setState('success');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMsg(message);
      setState('error');
    }
  };

  const handleSelectAsset = async (asset: SearchResult) => {
    const requestId = assetRequestRef.current + 1;
    assetRequestRef.current = requestId;
    setSelectedAsset(asset);
    setAssetContext(null);
    setAssetErrorMsg('');
    setIsAssetLoading(true);
    setIsSummaryLoading(false);
    setShowAiUnavailable(false);

    try {
      const response = await assetContextService.getAssetContext(asset.id);
      if (assetRequestRef.current !== requestId) {
        return;
      }

      setAssetContext(response);
    } catch (err: unknown) {
      if (assetRequestRef.current !== requestId) {
        return;
      }

      const message =
        err instanceof Error ? err.message : 'Unable to load asset details.';
      setAssetErrorMsg(message);
    } finally {
      if (assetRequestRef.current === requestId) {
        setIsAssetLoading(false);
      }
    }
  };

  const handleGenerateSummary = async () => {
    if (!selectedAsset) {
      return;
    }

    setIsSummaryLoading(true);
    setShowAiUnavailable(false);

    try {
      const response = await assetContextService.getAssetContext(selectedAsset.id, {
        includeAiSummary: true,
      });
      setAssetContext(response);
      setShowAiUnavailable(!response.aiSummary);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to generate AI summary.';
      setAssetContext((current) =>
        current
          ? {
              ...current,
              warnings: current.warnings.includes(message)
                ? current.warnings
                : [...current.warnings, message],
            }
          : current,
      );
      setShowAiUnavailable(true);
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const closeAssetPanel = () => {
    assetRequestRef.current += 1;
    setSelectedAsset(null);
    setAssetContext(null);
    setAssetErrorMsg('');
    setIsAssetLoading(false);
    setIsSummaryLoading(false);
    setShowAiUnavailable(false);
  };

  const handleArchiveNameChange = (value: string) => {
    setArchiveName(value);
  };

  const handleToggleFeaturedAsset = (asset: SearchResult) => {
    setFeaturedImages((current) => {
      const existing = current.find((item) => item.id === asset.id);
      if (existing) {
        return current.filter((item) => item.id !== asset.id);
      }

      if (current.length >= MAX_ARCHIVE_IMAGES) {
        return current;
      }

      return [
        ...current,
        {
          id: asset.id,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          thumbnailUrl: asset.thumbnailUrl,
          title: asset.title,
        },
      ];
    });
    setIsChoosingHeaderImage(false);
  };

  const handleRemoveFeaturedAsset = (assetId: string) => {
    setFeaturedImages((current) => current.filter((item) => item.id !== assetId));
  };

  const handleUpdateFeaturedAsset = (assetId: string, update: Partial<ArchiveFeaturedImage>) => {
    setFeaturedImages((current) =>
      current.map((item) => (item.id === assetId ? { ...item, ...update } : item)),
    );
  };

  return (
    <div className={styles.app}>
      <ArchiveHero
        featuredImages={featuredImages}
        isChoosingImage={isChoosingHeaderImage}
        name={archiveName.trim() || DEFAULT_ARCHIVE_NAME}
        onChooseImage={() => setIsChoosingHeaderImage((current) => !current)}
      />

      <main className={styles.main}>
        <div className={styles.controlGrid}>
          <section className={styles.panelCard}>
            <SearchForm onSearch={handleSearch} isLoading={state === 'loading'} />
          </section>

          <ArchiveStudio
            featuredImages={featuredImages}
            isChoosingImage={isChoosingHeaderImage}
            name={archiveName}
            onArchiveNameChange={handleArchiveNameChange}
            onRemoveImage={handleRemoveFeaturedAsset}
            onUpdateImage={handleUpdateFeaturedAsset}
          />
        </div>

        {state === 'error' && <ErrorBanner message={errorMsg} />}

        {state === 'loading' && (
          <EmptyState message="Searching…" />
        )}

        {state === 'success' && results.length === 0 && (
          <EmptyState message="No results found. Try a different query or date range." />
        )}

        {state === 'success' && results.length > 0 && (
          <SearchResults
            canAddMoreFeatured={featuredImages.length < MAX_ARCHIVE_IMAGES}
            featuredAssetIds={featuredImages.map((image) => image.id)}
            isChoosingHeaderImage={isChoosingHeaderImage}
            onSelectAsset={handleSelectAsset}
            onToggleFeaturedAsset={handleToggleFeaturedAsset}
            results={results}
            total={total}
          />
        )}

        {state === 'idle' && (
          <EmptyState message="Enter a search query to find your photos." />
        )}
      </main>

      <AssetDetailsPanel
        context={assetContext}
        errorMessage={assetErrorMsg}
        isGeneratingSummary={isSummaryLoading}
        isLoading={isAssetLoading}
        onClose={closeAssetPanel}
        onGenerateSummary={handleGenerateSummary}
        selectedAsset={selectedAsset}
        showAiUnavailable={showAiUnavailable}
      />
    </div>
  );
}

export default App;
