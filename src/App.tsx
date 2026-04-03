import { useEffect, useRef, useState } from 'react';
import type { ArchiveFeaturedImage, DocumentResult, SearchRequest, SearchResult, SearchSource } from './types';
import { ApiAssetContextService, ApiDocumentSearchService, ApiSearchService, ApiTrashService } from './services';
import type { AssetContextService, DocumentSearchService, SearchService, TrashService } from './services';
import type { AssetContextResponse } from './types';
import {
  ArchiveHero,
  ArchiveStudio,
  DEFAULT_ARCHIVE_NAME,
  MAX_ARCHIVE_IMAGES,
  loadArchivePreferences,
  saveArchivePreferences,
} from './features/archive';
import { AlbumDraftPanel, loadAlbumPreferences, saveAlbumPreferences } from './features/albums';
import { SearchForm, SearchResults } from './features/search';
import { DocumentResults } from './features/documents';
import { AssetDetailsPanel } from './features/assets';
import { EmptyState, ErrorBanner } from './components';
import styles from './App.module.css';

type SearchState = 'idle' | 'loading' | 'success' | 'error';

const defaultAssetContextService = new ApiAssetContextService();
const defaultSearchService = new ApiSearchService();
const defaultTrashService = new ApiTrashService();
const defaultDocumentSearchService = new ApiDocumentSearchService();

interface AppProps {
  assetContextService?: AssetContextService;
  documentSearchService?: DocumentSearchService;
  searchService?: SearchService;
  trashService?: TrashService;
}

interface AlbumDraft {
  id: string;
  isSaved: boolean;
  name: string;
  photos: SearchResult[];
}

function createAlbumDraftId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `album-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSuggestedAlbumName(): string {
  return '';
}

function App({
  assetContextService = defaultAssetContextService,
  documentSearchService = defaultDocumentSearchService,
  searchService = defaultSearchService,
  trashService = defaultTrashService,
}: AppProps) {
  const assetRequestRef = useRef(0);
  const initialAlbumPreferencesRef = useRef(loadAlbumPreferences());
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isTrashing, setIsTrashing] = useState(false);
  const [documentResults, setDocumentResults] = useState<DocumentResult[]>([]);
  const [documentTotal, setDocumentTotal] = useState(0);
  const [documentHasMore, setDocumentHasMore] = useState(false);
  const [documentPage, setDocumentPage] = useState(1);
  const [documentState, setDocumentState] = useState<SearchState>('idle');
  const [documentError, setDocumentError] = useState('');
  const [isLoadingMoreDocs, setIsLoadingMoreDocs] = useState(false);
  const [lastDocQuery, setLastDocQuery] = useState('');
  const [paperlessAvailable, setPaperlessAvailable] = useState(true);
  const [albumDrafts, setAlbumDrafts] = useState<AlbumDraft[]>(() => initialAlbumPreferencesRef.current.albums);
  const [isAlbumWorkspaceOpen, setIsAlbumWorkspaceOpen] = useState(false);
  const [activeAlbumDraftId, setActiveAlbumDraftId] = useState<string | null>(
    () => initialAlbumPreferencesRef.current.activeAlbumDraftId,
  );

  const activeAlbumDraft =
    activeAlbumDraftId === null
      ? null
      : albumDrafts.find((draft) => draft.id === activeAlbumDraftId) ?? null;

  useEffect(() => {
    saveArchivePreferences({
      featuredImages,
      name: archiveName.trim() || DEFAULT_ARCHIVE_NAME,
    });
  }, [archiveName, featuredImages]);

  useEffect(() => {
    saveAlbumPreferences({
      activeAlbumDraftId,
      albums: albumDrafts,
    });
  }, [activeAlbumDraftId, albumDrafts]);

  useEffect(() => {
    if (isChoosingHeaderImage || albumDrafts.length === 0) {
      return;
    }

    const hasActiveDraft = activeAlbumDraftId !== null && albumDrafts.some((draft) => draft.id === activeAlbumDraftId);
    if (!hasActiveDraft) {
      setActiveAlbumDraftId(albumDrafts[0].id);
    }
  }, [activeAlbumDraftId, albumDrafts, isChoosingHeaderImage]);

  const handleSearch = async (request: SearchRequest) => {
    const source: SearchSource = request.source ?? 'all';
    const searchPhotos = source === 'all' || source === 'photos';
    const searchDocs = (source === 'all' || source === 'documents') && paperlessAvailable;

    if (searchPhotos) {
      setState('loading');
      setErrorMsg('');
      setSelectedIds(new Set());
      closeAssetPanel();
    } else {
      setResults([]);
      setTotal(0);
      setState('idle');
    }

    if (searchDocs) {
      setDocumentState('loading');
      setDocumentError('');
      setDocumentResults([]);
      setDocumentTotal(0);
      setDocumentHasMore(false);
      setDocumentPage(1);
      setLastDocQuery(request.query);
    } else {
      setDocumentResults([]);
      setDocumentTotal(0);
      setDocumentState('idle');
    }

    const promises: Promise<void>[] = [];

    if (searchPhotos) {
      promises.push(
        searchService.search(request).then((response) => {
          setResults(response.results);
          setTotal(response.total);
          setState('success');
        }).catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
          setErrorMsg(message);
          setState('error');
        }),
      );
    }

    if (searchDocs) {
      promises.push(
        documentSearchService.searchDocuments(request.query).then((response) => {
          setDocumentResults(response.results);
          setDocumentTotal(response.total);
          setDocumentHasMore(response.hasMore);
          setDocumentPage(1);
          setDocumentState('success');
        }).catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Could not connect to the document archive.';
          setDocumentError(message);
          setDocumentState('error');
          if (message.includes('not configured')) {
            setPaperlessAvailable(false);
          }
        }),
      );
    }

    await Promise.allSettled(promises);
  };

  const handleLoadMoreDocuments = async () => {
    const nextPage = documentPage + 1;
    setIsLoadingMoreDocs(true);
    try {
      const response = await documentSearchService.searchDocuments(lastDocQuery, nextPage);
      setDocumentResults((current) => [...current, ...response.results]);
      setDocumentHasMore(response.hasMore);
      setDocumentPage(nextPage);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load more documents.';
      setDocumentError(message);
    } finally {
      setIsLoadingMoreDocs(false);
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

  const openHeaderEditor = () => {
    setIsChoosingHeaderImage(true);
  };

  const closeHeaderEditor = () => {
    setIsChoosingHeaderImage(false);
  };

  const closeAlbumWorkspace = () => {
    setIsAlbumWorkspaceOpen(false);
  };

  const handleCreateAlbumDraft = (initialPhoto?: SearchResult) => {
    const draftId = createAlbumDraftId();
    const nextDraft: AlbumDraft = {
      id: draftId,
      isSaved: false,
      name: buildSuggestedAlbumName(),
      photos: initialPhoto ? [initialPhoto] : [],
    };

    setAlbumDrafts((current) => [...current, nextDraft]);
    setIsChoosingHeaderImage(false);
    setIsAlbumWorkspaceOpen(true);
    setActiveAlbumDraftId(draftId);
  };

  const handleToggleAlbumPhoto = (asset: SearchResult) => {
    setIsAlbumWorkspaceOpen(true);

    if (!activeAlbumDraftId) {
      handleCreateAlbumDraft(asset);
      return;
    }

    setIsChoosingHeaderImage(false);
    setAlbumDrafts((current) =>
      current.map((draft) => {
        if (draft.id !== activeAlbumDraftId) {
          return draft;
        }

        if (draft.photos.some((photo) => photo.id === asset.id)) {
          return draft;
        }

        return {
          ...draft,
          isSaved: false,
          photos: [...draft.photos, asset],
        };
      }),
    );
  };

  const handleRemoveAlbumPhoto = (id: string) => {
    if (!activeAlbumDraftId) {
      return;
    }

    setAlbumDrafts((current) =>
      current.map((draft) =>
        draft.id === activeAlbumDraftId
          ? {
              ...draft,
              isSaved: false,
              photos: draft.photos.filter((photo) => photo.id !== id),
            }
          : draft,
      ),
    );
  };

  const handleAlbumNameChange = (value: string) => {
    if (!activeAlbumDraftId) {
      return;
    }

    setAlbumDrafts((current) =>
      current.map((draft) =>
        draft.id === activeAlbumDraftId
          ? {
              ...draft,
              isSaved: false,
              name: value,
            }
          : draft,
      ),
    );
  };

  const handleSelectAlbumDraft = (id: string) => {
    setIsChoosingHeaderImage(false);
    setIsAlbumWorkspaceOpen(true);
    setActiveAlbumDraftId(id);
  };

  const handleSaveAlbum = () => {
    if (!activeAlbumDraft) {
      return;
    }

    console.log('Save album:', {
      name: activeAlbumDraft.name,
      photoIds: activeAlbumDraft.photos.map((photo) => photo.id),
    });

    setAlbumDrafts((current) =>
      current.map((draft) =>
        draft.id === activeAlbumDraft.id
          ? {
              ...draft,
              isSaved: true,
            }
          : draft,
      ),
    );
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
          caption: asset.title,
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

  const handleToggleSelect = (id: string) => {
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

  const handleTrashAssets = async (ids: string[]) => {
    setIsTrashing(true);
    try {
      await trashService.trashAssets(ids);
      const trashedSet = new Set(ids);
      setResults((current) => current.filter((item) => !trashedSet.has(item.id)));
      setTotal((current) => Math.max(0, current - ids.length));
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const id of ids) {
          next.delete(id);
        }
        return next;
      });
      if (selectedAsset && trashedSet.has(selectedAsset.id)) {
        closeAssetPanel();
      }
      setFeaturedImages((current) => current.filter((item) => !trashedSet.has(item.id)));
      setAlbumDrafts((current) =>
        current.map((draft) => ({
          ...draft,
          photos: draft.photos.filter((photo) => !trashedSet.has(photo.id)),
        })),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to move assets to trash.';
      setErrorMsg(message);
    } finally {
      setIsTrashing(false);
    }
  };

  return (
    <div className={styles.app}>
      <ArchiveHero
        featuredImages={featuredImages}
        name={archiveName.trim() || DEFAULT_ARCHIVE_NAME}
        onOpenEditor={openHeaderEditor}
        onRenameImage={(assetId, caption) => {
          handleUpdateFeaturedAsset(assetId, { caption });
        }}
      />

      <main className={styles.main}>
        <div className={styles.controlGrid}>
          <section className={styles.panelCard}>
            <SearchForm onSearch={handleSearch} isLoading={state === 'loading' || documentState === 'loading'} showSourceFilter={paperlessAvailable} />
          </section>

          {isChoosingHeaderImage && (
            <ArchiveStudio
              featuredImages={featuredImages}
              name={archiveName}
              onArchiveNameChange={handleArchiveNameChange}
              onClose={closeHeaderEditor}
              onRemoveImage={handleRemoveFeaturedAsset}
              onUpdateImage={handleUpdateFeaturedAsset}
            />
          )}
        </div>

        {state === 'error' && <ErrorBanner message={errorMsg} />}

        {state === 'loading' && (
          <EmptyState message="Searching…" />
        )}

        {state === 'success' && results.length === 0 && (
          <EmptyState message="No results found. Try a different query or date range." />
        )}

        {state === 'success' && results.length > 0 && (
          <div
            className={`${styles.workspaceLayout} ${isAlbumWorkspaceOpen ? styles.workspaceLayoutDualPane : styles.workspaceLayoutSinglePane}`}
          >
            <div className={styles.resultsColumn}>
              <SearchResults
                isAlbumWorkspaceOpen={isAlbumWorkspaceOpen}
                canAddMoreFeatured={featuredImages.length < MAX_ARCHIVE_IMAGES}
                draftAlbumPhotoIds={activeAlbumDraft?.photos.map((photo) => photo.id) ?? []}
                featuredAssetIds={featuredImages.map((image) => image.id)}
                isCompactLayout={isAlbumWorkspaceOpen}
                isChoosingHeaderImage={isChoosingHeaderImage}
                isTrashing={isTrashing}
                onSelectAsset={handleSelectAsset}
                onToggleAlbumPhoto={handleToggleAlbumPhoto}
                onToggleFeaturedAsset={handleToggleFeaturedAsset}
                onTrashAssets={handleTrashAssets}
                results={results}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                total={total}
              />
            </div>

            {isAlbumWorkspaceOpen && (
              <>
                <div aria-hidden="true" className={styles.paneDivider} />

                <aside className={styles.sidePanelColumn}>
                  <AlbumDraftPanel
                    albums={albumDrafts.map((draft) => ({
                      id: draft.id,
                      name: draft.name.trim() || 'Untitled',
                      photoCount: draft.photos.length,
                    }))}
                    hasActiveAlbum={Boolean(activeAlbumDraft)}
                    isSaved={activeAlbumDraft?.isSaved ?? false}
                    name={activeAlbumDraft?.name ?? ''}
                    onClose={closeAlbumWorkspace}
                    onCreateAlbum={handleCreateAlbumDraft}
                    onNameChange={handleAlbumNameChange}
                    onRemovePhoto={handleRemoveAlbumPhoto}
                    onSave={handleSaveAlbum}
                    onSelectAlbum={handleSelectAlbumDraft}
                    photos={activeAlbumDraft?.photos ?? []}
                    selectedAlbumId={activeAlbumDraft?.id ?? ''}
                  />
                </aside>
              </>
            )}
          </div>
        )}

        {documentState === 'error' && <ErrorBanner message={documentError} />}

        {documentState === 'loading' && (
          <EmptyState message="Searching documents…" />
        )}

        {documentState === 'success' && documentResults.length === 0 && (
          <EmptyState message="No documents found." />
        )}

        {documentState === 'success' && documentResults.length > 0 && (
          <DocumentResults
            results={documentResults}
            total={documentTotal}
            hasMore={documentHasMore}
            isLoadingMore={isLoadingMoreDocs}
            onLoadMore={handleLoadMoreDocuments}
          />
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
