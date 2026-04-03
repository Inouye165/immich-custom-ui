import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SearchResults } from '../features/search/SearchResults';
import type { SearchResult } from '../types';

const SAMPLE_RESULTS: SearchResult[] = [
  {
    id: '1',
    title: 'Sunset at the beach',
    thumbnailUrl: '/api/assets/1/thumbnail?size=preview',
    date: '2024-08-15',
    description: 'Golden hour at the coast.',
  },
  {
    id: '2',
    title: 'Mountain hike',
    thumbnailUrl: '/api/assets/2/thumbnail?size=preview',
    date: '2024-07-22',
    description: 'Trail through alpine meadows.',
  },
];

describe('SearchResults', () => {
  it('renders result cards with friendly labels and descriptions', () => {
    render(
      <SearchResults
        isAlbumWorkspaceOpen={false}
        canAddMoreFeatured={true}
        draftAlbumPhotoIds={[]}
        featuredAssetIds={[]}
        isCompactLayout={false}
        isChoosingHeaderImage={false}
        isTrashing={false}
        onSelectAsset={vi.fn()}
        onToggleAlbumPhoto={vi.fn()}
        onToggleFeaturedAsset={vi.fn()}
        onToggleSelect={vi.fn()}
        onTrashAssets={vi.fn()}
        results={SAMPLE_RESULTS}
        selectedIds={new Set<string>()}
        total={2}
      />,
    );

    // Friendly labels show date (+ location extracted from description)
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings).toHaveLength(2);
    expect(screen.getByText('Golden hour at the coast.')).toBeInTheDocument();
    expect(screen.getByText(/results found/)).toBeInTheDocument();
  });

  it('renders images with alt text', () => {
    render(
      <SearchResults
        isAlbumWorkspaceOpen={false}
        canAddMoreFeatured={true}
        draftAlbumPhotoIds={[]}
        featuredAssetIds={[]}
        isCompactLayout={false}
        isChoosingHeaderImage={false}
        isTrashing={false}
        onSelectAsset={vi.fn()}
        onToggleAlbumPhoto={vi.fn()}
        onToggleFeaturedAsset={vi.fn()}
        onToggleSelect={vi.fn()}
        onTrashAssets={vi.fn()}
        results={SAMPLE_RESULTS}
        selectedIds={new Set<string>()}
        total={2}
      />,
    );

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute('alt', 'Sunset at the beach');
  });

  it('uses singular "result" for count of 1', () => {
    render(
      <SearchResults
        isAlbumWorkspaceOpen={false}
        canAddMoreFeatured={true}
        draftAlbumPhotoIds={[]}
        featuredAssetIds={[]}
        isCompactLayout={false}
        isChoosingHeaderImage={false}
        isTrashing={false}
        onSelectAsset={vi.fn()}
        onToggleAlbumPhoto={vi.fn()}
        onToggleFeaturedAsset={vi.fn()}
        onToggleSelect={vi.fn()}
        onTrashAssets={vi.fn()}
        results={[SAMPLE_RESULTS[0]]}
        selectedIds={new Set<string>()}
        total={1}
      />,
    );

    expect(screen.getByText(/result found/)).toBeInTheDocument();
    expect(screen.queryByText(/results found/)).not.toBeInTheDocument();
  });

  it('opens an asset when a result is clicked', async () => {
    const user = userEvent.setup();
    const onSelectAsset = vi.fn();

    render(
      <SearchResults
        isAlbumWorkspaceOpen={false}
        canAddMoreFeatured={true}
        draftAlbumPhotoIds={[]}
        featuredAssetIds={[]}
        isCompactLayout={false}
        isChoosingHeaderImage={false}
        isTrashing={false}
        onSelectAsset={onSelectAsset}
        onToggleAlbumPhoto={vi.fn()}
        onToggleFeaturedAsset={vi.fn()}
        onToggleSelect={vi.fn()}
        onTrashAssets={vi.fn()}
        results={SAMPLE_RESULTS}
        selectedIds={new Set<string>()}
        total={2}
      />,
    );

    await user.click(screen.getByRole('button', { name: /open details for sunset at the beach/i }));

    expect(onSelectAsset).toHaveBeenCalledWith(SAMPLE_RESULTS[0]);
  });

  it('shows header actions only while choosing an image', async () => {
    const user = userEvent.setup();
    const onToggleFeaturedAsset = vi.fn();

    const { rerender } = render(
      <SearchResults
        isAlbumWorkspaceOpen={false}
        canAddMoreFeatured={true}
        draftAlbumPhotoIds={[]}
        featuredAssetIds={[]}
        isCompactLayout={false}
        isChoosingHeaderImage={false}
        isTrashing={false}
        onSelectAsset={vi.fn()}
        onToggleAlbumPhoto={vi.fn()}
        onToggleFeaturedAsset={onToggleFeaturedAsset}
        onToggleSelect={vi.fn()}
        onTrashAssets={vi.fn()}
        results={SAMPLE_RESULTS}
        selectedIds={new Set<string>()}
        total={2}
      />,
    );

    expect(screen.queryByRole('button', { name: /use sunset at the beach in header/i })).not.toBeInTheDocument();

    rerender(
      <SearchResults
        isAlbumWorkspaceOpen={false}
        canAddMoreFeatured={true}
        draftAlbumPhotoIds={[]}
        featuredAssetIds={[]}
        isCompactLayout={false}
        isChoosingHeaderImage={true}
        isTrashing={false}
        onSelectAsset={vi.fn()}
        onToggleAlbumPhoto={vi.fn()}
        onToggleFeaturedAsset={onToggleFeaturedAsset}
        onToggleSelect={vi.fn()}
        onTrashAssets={vi.fn()}
        results={SAMPLE_RESULTS}
        selectedIds={new Set<string>()}
        total={2}
      />,
    );

    await user.click(screen.getByRole('button', { name: /use sunset at the beach in header/i }));

    expect(onToggleFeaturedAsset).toHaveBeenCalledWith(SAMPLE_RESULTS[0]);

    rerender(
      <SearchResults
        canAddMoreFeatured={true}
        draftAlbumPhotoIds={[]}
        featuredAssetIds={['1']}
        isCompactLayout={false}
        isChoosingHeaderImage={false}
        isTrashing={false}
        onSelectAsset={vi.fn()}
        onToggleAlbumPhoto={vi.fn()}
        onToggleFeaturedAsset={onToggleFeaturedAsset}
        onToggleSelect={vi.fn()}
        onTrashAssets={vi.fn()}
        results={SAMPLE_RESULTS}
        selectedIds={new Set<string>()}
        total={2}
      />,
    );

    expect(screen.queryByRole('button', { name: /remove sunset at the beach from header/i })).not.toBeInTheDocument();
  });

  it('disables the album button when the photo is already in the active draft', () => {
    render(
      <SearchResults
        isAlbumWorkspaceOpen={true}
        canAddMoreFeatured={true}
        draftAlbumPhotoIds={['1']}
        featuredAssetIds={[]}
        isCompactLayout={true}
        isChoosingHeaderImage={false}
        isTrashing={false}
        onSelectAsset={vi.fn()}
        onToggleAlbumPhoto={vi.fn()}
        onToggleFeaturedAsset={vi.fn()}
        onToggleSelect={vi.fn()}
        onTrashAssets={vi.fn()}
        results={SAMPLE_RESULTS}
        selectedIds={new Set<string>()}
        total={2}
      />,
    );

    expect(screen.getByRole('button', { name: /sunset at the beach already added to album/i })).toBeDisabled();
  });

  it('shows an open album action when the photo is already in the active draft but the workspace is hidden', async () => {
    const user = userEvent.setup();
    const onToggleAlbumPhoto = vi.fn();

    render(
      <SearchResults
        isAlbumWorkspaceOpen={false}
        canAddMoreFeatured={true}
        draftAlbumPhotoIds={['1']}
        featuredAssetIds={[]}
        isCompactLayout={false}
        isChoosingHeaderImage={false}
        isTrashing={false}
        onSelectAsset={vi.fn()}
        onToggleAlbumPhoto={onToggleAlbumPhoto}
        onToggleFeaturedAsset={vi.fn()}
        onToggleSelect={vi.fn()}
        onTrashAssets={vi.fn()}
        results={SAMPLE_RESULTS}
        selectedIds={new Set<string>()}
        total={2}
      />,
    );

    await user.click(screen.getByRole('button', { name: /open album for sunset at the beach/i }));
    expect(onToggleAlbumPhoto).toHaveBeenCalledWith(SAMPLE_RESULTS[0]);
  });
});
