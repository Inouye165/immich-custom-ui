import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AlbumDraftPanel } from '../features/albums';
import type { SearchResult } from '../types';

const SAMPLE_ALBUMS = [
  {
    id: 'album-1',
    name: 'Sunset at the beach',
    photoCount: 2,
  },
  {
    id: 'album-2',
    name: 'Possibilities',
    photoCount: 1,
  },
];

const SAMPLE_PHOTOS: SearchResult[] = [
  {
    id: 'a1',
    title: 'sunset.jpg',
    thumbnailUrl: '/api/assets/a1/thumbnail?size=preview',
    date: '2024-08-15',
    description: 'Beach sunset',
  },
  {
    id: 'a2',
    title: 'mountain.jpg',
    thumbnailUrl: '/api/assets/a2/thumbnail?size=preview',
    date: '2024-07-22',
    description: 'Mountain view',
  },
];

describe('AlbumDraftPanel', () => {
  it('renders the correct number of selected photos', () => {
    render(
      <AlbumDraftPanel
        albums={SAMPLE_ALBUMS}
        hasActiveAlbum
        isSaved={false}
        name="Untitled"
        onClose={vi.fn()}
        onCreateAlbum={vi.fn()}
        onNameChange={vi.fn()}
        onRemovePhoto={vi.fn()}
        onSave={vi.fn()}
        onSelectAlbum={vi.fn()}
        photos={SAMPLE_PHOTOS}
        selectedAlbumId="album-1"
      />,
    );

    expect(screen.getByText('2 photos')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /sunset\.jpg|mountain\.jpg/ })).toHaveLength(2);
  });

  it('uses singular "photo" for count of 1', () => {
    render(
      <AlbumDraftPanel
        albums={SAMPLE_ALBUMS}
        hasActiveAlbum
        isSaved={false}
        name="Untitled"
        onClose={vi.fn()}
        onCreateAlbum={vi.fn()}
        onNameChange={vi.fn()}
        onRemovePhoto={vi.fn()}
        onSave={vi.fn()}
        onSelectAlbum={vi.fn()}
        photos={[SAMPLE_PHOTOS[0]]}
        selectedAlbumId="album-1"
      />,
    );

    expect(screen.getByText('1 photo')).toBeInTheDocument();
  });

  it('disables the Save Album button when 0 photos are selected', () => {
    render(
      <AlbumDraftPanel
        albums={SAMPLE_ALBUMS}
        hasActiveAlbum
        isSaved={false}
        name="Untitled"
        onClose={vi.fn()}
        onCreateAlbum={vi.fn()}
        onNameChange={vi.fn()}
        onRemovePhoto={vi.fn()}
        onSave={vi.fn()}
        onSelectAlbum={vi.fn()}
        photos={[]}
        selectedAlbumId="album-1"
      />,
    );

    expect(screen.getByRole('button', { name: 'Save Album' })).toBeDisabled();
  });

  it('enables the Save Album button when photos are selected', () => {
    render(
      <AlbumDraftPanel
        albums={SAMPLE_ALBUMS}
        hasActiveAlbum
        isSaved={false}
        name="Untitled"
        onCreateAlbum={vi.fn()}
        onClose={vi.fn()}
        onNameChange={vi.fn()}
        onRemovePhoto={vi.fn()}
        onSave={vi.fn()}
        onSelectAlbum={vi.fn()}
        photos={SAMPLE_PHOTOS}
        selectedAlbumId="album-1"
      />,
    );

    expect(screen.getByRole('button', { name: 'Save Album' })).toBeEnabled();
  });

  it('calls onRemovePhoto with the correct ID when remove button is clicked', async () => {
    const user = userEvent.setup();
    const onRemovePhoto = vi.fn();

    render(
      <AlbumDraftPanel
        albums={SAMPLE_ALBUMS}
        hasActiveAlbum
        isSaved={false}
        name="Untitled"
        onClose={vi.fn()}
        onCreateAlbum={vi.fn()}
        onNameChange={vi.fn()}
        onRemovePhoto={onRemovePhoto}
        onSave={vi.fn()}
        onSelectAlbum={vi.fn()}
        photos={SAMPLE_PHOTOS}
        selectedAlbumId="album-1"
      />,
    );

    await user.click(screen.getByRole('button', { name: /remove sunset\.jpg/i }));
    expect(onRemovePhoto).toHaveBeenCalledWith('a1');

    await user.click(screen.getByRole('button', { name: /remove mountain\.jpg/i }));
    expect(onRemovePhoto).toHaveBeenCalledWith('a2');
  });

  it('calls onNameChange when typing in the title input', async () => {
    const user = userEvent.setup();
    const onNameChange = vi.fn();

    render(
      <AlbumDraftPanel
        albums={SAMPLE_ALBUMS}
        hasActiveAlbum
        isSaved={false}
        name=""
        onClose={vi.fn()}
        onCreateAlbum={vi.fn()}
        onNameChange={onNameChange}
        onRemovePhoto={vi.fn()}
        onSave={vi.fn()}
        onSelectAlbum={vi.fn()}
        photos={[]}
        selectedAlbumId="album-1"
      />,
    );

    await user.type(screen.getByLabelText('Album name'), 'Summer');
    expect(onNameChange).toHaveBeenCalled();
    expect(onNameChange.mock.calls.some((call: string[]) => call[0].includes('S'))).toBe(true);
  });

  it('calls onSave when Save Album button is clicked', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <AlbumDraftPanel
        albums={SAMPLE_ALBUMS}
        hasActiveAlbum
        isSaved={false}
        name="My Album"
        onClose={vi.fn()}
        onCreateAlbum={vi.fn()}
        onNameChange={vi.fn()}
        onRemovePhoto={vi.fn()}
        onSave={onSave}
        onSelectAlbum={vi.fn()}
        photos={SAMPLE_PHOTOS}
        selectedAlbumId="album-1"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Save Album' }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('calls onClose when Close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <AlbumDraftPanel
        albums={SAMPLE_ALBUMS}
        hasActiveAlbum
        isSaved={false}
        name="My Album"
        onClose={onClose}
        onCreateAlbum={vi.fn()}
        onNameChange={vi.fn()}
        onRemovePhoto={vi.fn()}
        onSave={vi.fn()}
        onSelectAlbum={vi.fn()}
        photos={SAMPLE_PHOTOS}
        selectedAlbumId="album-1"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Close album workspace' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onSelectAlbum when the dropdown changes', async () => {
    const user = userEvent.setup();
    const onSelectAlbum = vi.fn();

    render(
      <AlbumDraftPanel
        albums={SAMPLE_ALBUMS}
        hasActiveAlbum
        isSaved={false}
        name="Sunset at the beach"
        onClose={vi.fn()}
        onCreateAlbum={vi.fn()}
        onNameChange={vi.fn()}
        onRemovePhoto={vi.fn()}
        onSave={vi.fn()}
        onSelectAlbum={onSelectAlbum}
        photos={SAMPLE_PHOTOS}
        selectedAlbumId="album-1"
      />,
    );

    await user.selectOptions(screen.getByLabelText('Switch album draft'), 'album-2');
    expect(onSelectAlbum).toHaveBeenCalledWith('album-2');
  });
});
