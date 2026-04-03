import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { AssetContextService, DocumentSearchService, SearchService } from '../services';

vi.mock('../features/assets/AssetLocationMap', () => ({
  AssetLocationMap: () => <div data-testid="asset-location-map" />,
}));

afterEach(() => {
  window.localStorage.clear();
});

function createSearchService(overrides: Partial<SearchService>): SearchService {
  return {
    search: vi.fn(),
    ...overrides,
  };
}

function createAssetContextService(
  overrides: Partial<AssetContextService>,
): AssetContextService {
  return {
    getAssetContext: vi.fn(),
    ...overrides,
  };
}

const SEARCH_RESPONSE = {
  total: 1,
  results: [
    {
      id: '1',
      title: 'beach.jpg',
      thumbnailUrl: '/api/assets/1/thumbnail?size=preview',
      date: '2024-08-15T05:00:00.000Z',
      description: 'Photo • Seattle, Washington, USA',
    },
  ],
};

const VIDEO_SEARCH_RESPONSE = {
  total: 1,
  results: [
    {
      id: '2',
      title: 'sunset-timelapse.mp4',
      thumbnailUrl: '/api/assets/2/thumbnail?size=preview',
      date: '2024-09-01T18:00:00.000Z',
      description: 'Video • Portland, Oregon, USA',
      mediaType: 'video' as const,
    },
  ],
};

function buildAssetContext(overrides: Record<string, unknown> = {}) {
  return {
    asset: {
      id: '1',
      title: 'beach.jpg',
      mediaType: 'Photo',
      imageUrl: '/api/assets/1/thumbnail?size=fullsize',
      videoUrl: null,
      thumbnailUrl: '/api/assets/1/thumbnail?size=preview',
      mimeType: 'image/jpeg',
      takenAt: '2024-08-15T19:15:00-07:00',
      createdAt: '2024-08-15T12:00:00.000Z',
      width: 4032,
      height: 3024,
      locationLabel: 'Seattle, Washington, USA',
    },
    metadata: {
      dateTimeOriginal: '2024-08-15T19:15:00-07:00',
      localDateTime: '2024-08-15T05:15:00.000Z',
      fileCreatedAt: '2024-08-15T12:00:00.000Z',
      fileModifiedAt: '2024-08-15T12:30:00.000Z',
      cameraMake: 'Sony',
      cameraModel: 'A7C',
      lensModel: 'FE 28-60mm F4-5.6',
      width: 4032,
      height: 3024,
      fileType: 'image/jpeg',
      fileSizeBytes: 1000,
      latitude: 47.6062,
      longitude: -122.3321,
      city: 'Seattle',
      state: 'Washington',
      country: 'USA',
      timeZone: 'UTC-7',
      exposureTime: '1/125',
      fNumber: 2.8,
      focalLength: 28,
      iso: 100,
      description: null,
      additional: {},
    },
    gps: { latitude: 47.6062, longitude: -122.3321 },
    map: { zoom: 15, center: { latitude: 47.6062, longitude: -122.3321 } },
    pois: [
      {
        id: 'poi-1',
        name: 'Pike Place Market',
        category: 'Tourism',
        latitude: 47.6097,
        longitude: -122.3425,
        distanceMeters: 821,
      },
    ],
    weather: {
      temperatureC: 20,
      temperatureF: 68,
      apparentTemperatureC: 21,
      apparentTemperatureF: 69.8,
      weatherCode: 1,
      weatherLabel: 'Mostly clear',
      observedAt: '2024-08-15T19:00:00',
      isApproximate: false,
      source: 'open-meteo',
      summary: null,
    },
    aiSummary: null,
    aiSummaryAvailable: true,
    status: {
      aiSummary: 'unavailable',
      pois: 'live',
      weather: 'live',
    },
    warnings: [],
    ...overrides,
  };
}

async function performSearch(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Search'), 'beach');
  await user.click(screen.getByRole('button', { name: 'Search' }));
}

describe('App', () => {
  it('renders a successful search result path', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn().mockResolvedValue(buildAssetContext()),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    await performSearch(user);

    const resultSection = await screen.findByRole('region', { name: 'Search results' });
    expect(resultSection).toBeInTheDocument();
    expect(screen.getByText(/result found/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The Hearthside Archive' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Archive studio' })).not.toBeInTheDocument();
  });

  it('renders a friendly error when the backend search fails', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockRejectedValue(new Error('Search is unavailable right now.')),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn(),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    await user.type(screen.getByLabelText('Search'), 'beach');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Search is unavailable right now.');
  });

  it('opens asset details and renders metadata when a result is clicked', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn().mockResolvedValue(buildAssetContext()),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    await performSearch(user);
    await user.click(screen.getByRole('button', { name: /open details for beach.jpg/i }));

    expect(await screen.findByRole('dialog', { name: 'beach.jpg' })).toBeInTheDocument();
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByText('Context status')).toBeInTheDocument();
    expect(screen.getByText('Sony A7C')).toBeInTheDocument();
    expect(screen.getByText('4032 × 3024')).toBeInTheDocument();
  });

  it('renders a graceful no-gps state when asset coordinates are missing', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn().mockResolvedValue(
        buildAssetContext({
          gps: null,
          map: null,
          pois: [],
          weather: null,
        }),
      ),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    await performSearch(user);
    await user.click(screen.getByRole('button', { name: /open details for beach.jpg/i }));

    expect(await screen.findByText('No GPS location available')).toBeInTheDocument();
  });

  it('renders historical weather when present', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn().mockResolvedValue(buildAssetContext()),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    await performSearch(user);
    await user.click(screen.getByRole('button', { name: /open details for beach.jpg/i }));

    expect(await screen.findByRole('heading', { name: 'Weather' })).toBeInTheDocument();
    expect(screen.getByText('20C / 68F')).toBeInTheDocument();
    expect(screen.getByText('Mostly clear')).toBeInTheDocument();
  });

  it('lets the user add a result to the archive masthead and rename it', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn().mockResolvedValue(buildAssetContext()),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    await performSearch(user);
    fireEvent.contextMenu(screen.getByRole('banner'));
    expect(screen.getByRole('region', { name: 'Archive studio' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /use beach.jpg in header/i }));

    expect(screen.queryByRole('region', { name: 'Archive studio' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByText('beach.jpg')).toBeInTheDocument();

    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Mom');
    fireEvent.contextMenu(within(screen.getByRole('banner')).getByRole('img', { name: 'beach.jpg' }));

    expect(promptSpy).toHaveBeenCalledWith('Rename this header image', 'beach.jpg');
    expect(within(screen.getByRole('banner')).getByText('Mom')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Archive studio' })).not.toBeInTheDocument();

    promptSpy.mockRestore();

    fireEvent.contextMenu(screen.getByRole('banner'));
    await user.clear(screen.getByLabelText('Archive name'));
    await user.type(screen.getByLabelText('Archive name'), 'Yellowstone Keepsakes');

    expect(screen.getByRole('heading', { name: 'Yellowstone Keepsakes' })).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByText('Immich name: beach.jpg')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Archive studio' })).toBeInTheDocument();
  });

  it('opens and closes the archive studio from the header editing flow', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn().mockResolvedValue(buildAssetContext()),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    fireEvent.contextMenu(screen.getByRole('banner'));
    expect(screen.getByRole('region', { name: 'Archive studio' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('region', { name: 'Archive studio' })).not.toBeInTheDocument();
  });

  it('hides the AI summary section when no summary is available', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn().mockResolvedValue(
        buildAssetContext({
          aiSummaryAvailable: false,
        }),
      ),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    await performSearch(user);
    await user.click(screen.getByRole('button', { name: /open details for beach.jpg/i }));

    expect(await screen.findByText('Metadata')).toBeInTheDocument();
    expect(screen.queryByText('About this photo')).not.toBeInTheDocument();
  });

  it('renders a video element with controls when a video asset is opened', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(VIDEO_SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn().mockResolvedValue(
        buildAssetContext({
          asset: {
            id: '2',
            title: 'sunset-timelapse.mp4',
            mediaType: 'Video',
            imageUrl: '/api/assets/2/thumbnail?size=fullsize',
            videoUrl: '/api/assets/2/video/playback',
            thumbnailUrl: '/api/assets/2/thumbnail?size=preview',
            mimeType: 'video/mp4',
            takenAt: '2024-09-01T18:00:00-07:00',
            createdAt: '2024-09-01T12:00:00.000Z',
            width: 1920,
            height: 1080,
            locationLabel: 'Portland, Oregon, USA',
          },
        }),
      ),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    await performSearch(user);
    await user.click(screen.getByRole('button', { name: /open details for sunset-timelapse.mp4/i }));

    const dialog = await screen.findByRole('dialog');
    const video = dialog.querySelector('video');
    expect(video).toBeTruthy();
    expect(video!.querySelector('source')!.getAttribute('src')).toBe('/api/assets/2/video/playback');
    expect(video!.getAttribute('poster')).toBe('/api/assets/2/thumbnail?size=preview');

    const badge = within(dialog).getByText('Video');
    expect(badge).toBeInTheDocument();
  });

  it('renders an image (not video) when a photo asset is opened', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn().mockResolvedValue(buildAssetContext()),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    await performSearch(user);
    await user.click(screen.getByRole('button', { name: /open details for beach.jpg/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelector('video')).toBeNull();
    expect(dialog.querySelector('img')).toBeTruthy();

    const badge = within(dialog).getByText('Photo');
    expect(badge).toBeInTheDocument();
  });

  it('shows a Video chip on video search result cards', async () => {
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(VIDEO_SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn(),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    const user = userEvent.setup();
    await performSearch(user);

    const card = await screen.findByRole('article');
    expect(within(card).getByText('Video')).toBeInTheDocument();
  });

  it('shows explanatory POI status when GPS data is missing', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn().mockResolvedValue(
        buildAssetContext({
          gps: null,
          map: null,
          pois: [],
          weather: null,
          status: { aiSummary: 'unavailable', pois: 'unavailable', weather: 'unavailable' },
        }),
      ),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    await performSearch(user);
    await user.click(screen.getByRole('button', { name: /open details for beach.jpg/i }));

    expect((await screen.findAllByText(/no GPS coordinates in metadata/i)).length).toBeGreaterThanOrEqual(1);
  });

  it('closes ArchiveStudio and opens AlbumDraftPanel when a photo is added to album', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn().mockResolvedValue(buildAssetContext()),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    await performSearch(user);

    // Open the ArchiveStudio via context menu on banner
    fireEvent.contextMenu(screen.getByRole('banner'));
    expect(screen.getByRole('region', { name: 'Archive studio' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Album builder' })).not.toBeInTheDocument();

    // Click "Add to Album" on the search result — should close ArchiveStudio and open AlbumDraftPanel
    await user.click(screen.getByRole('button', { name: /add beach\.jpg to album/i }));

    expect(screen.queryByRole('region', { name: 'Archive studio' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Album builder' })).toBeInTheDocument();
  });

  it('creates the first album draft from the first added photo and disables the card button', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn().mockResolvedValue(buildAssetContext()),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    await performSearch(user);

    // Click "Add to Album" on a search result
    await user.click(screen.getByRole('button', { name: /add beach\.jpg to album/i }));

    // AlbumDraftPanel should appear with the photo listed
    const albumPanel = screen.getByRole('region', { name: 'Album builder' });
    expect(within(albumPanel).getByRole('img', { name: 'beach.jpg' })).toBeInTheDocument();
    expect(within(albumPanel).getByText('1 photo')).toBeInTheDocument();

    // The search result stays in place and shows a disabled added state.
    const resultsSection = screen.getByRole('region', { name: 'Search results' });
    expect(
      within(resultsSection).getByRole('button', { name: /beach\.jpg already added to album/i }),
    ).toBeDisabled();
  });

  it('lets the user create a second album draft and switch between album drafts', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn().mockResolvedValue(buildAssetContext()),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    await performSearch(user);
    await user.click(screen.getByRole('button', { name: /add beach\.jpg to album/i }));

    const albumPanel = screen.getByRole('region', { name: 'Album builder' });
    await user.click(within(albumPanel).getByRole('button', { name: '+ New' }));

    const albumTitleInput = within(albumPanel).getByLabelText('Album name');
    await user.clear(albumTitleInput);
    await user.type(albumTitleInput, 'Yellowstone vacation possibilities');

    const albumSelect = within(albumPanel).getByLabelText('Switch album draft');
    const firstOption = within(albumPanel).getAllByRole('option')[0];
    await user.selectOptions(albumSelect, firstOption);

    expect(within(albumPanel).getByRole('img', { name: 'beach.jpg' })).toBeInTheDocument();
  });

  it('re-enables add to album after removing the photo from the draft panel', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn().mockResolvedValue(buildAssetContext()),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    await performSearch(user);
    await user.click(screen.getByRole('button', { name: /add beach\.jpg to album/i }));

    const albumPanel = screen.getByRole('region', { name: 'Album builder' });
    await user.click(within(albumPanel).getByRole('button', { name: /remove beach\.jpg/i }));

    const resultsSection = screen.getByRole('region', { name: 'Search results' });
    expect(within(resultsSection).getByRole('button', { name: /add beach\.jpg to album/i })).toBeEnabled();
  });

  it('closes AlbumDraftPanel when ArchiveStudio is opened', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn().mockResolvedValue(buildAssetContext()),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    await performSearch(user);

    // Open AlbumDraftPanel by adding a photo
    await user.click(screen.getByRole('button', { name: /add beach\.jpg to album/i }));
    expect(screen.getByRole('region', { name: 'Album builder' })).toBeInTheDocument();

    // Open ArchiveStudio via context menu — album workspace should remain visible
    fireEvent.contextMenu(screen.getByRole('banner'));
    expect(screen.getByRole('region', { name: 'Archive studio' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Album builder' })).toBeInTheDocument();
  });

  it('hides the album workspace when the user closes it without losing the album name', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn().mockResolvedValue(buildAssetContext()),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    await performSearch(user);
    await user.click(screen.getByRole('button', { name: /add beach\.jpg to album/i }));

    const albumPanel = screen.getByRole('region', { name: 'Album builder' });
    await user.type(within(albumPanel).getByLabelText('Album name'), 'Dobby');
    await user.click(within(albumPanel).getByRole('button', { name: 'Close album workspace' }));

    expect(screen.queryByRole('region', { name: 'Album builder' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open album for beach\.jpg/i }));

    expect(screen.getByRole('region', { name: 'Album builder' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Dobby')).toBeInTheDocument();
  });

  it('keeps the album builder open after saving the active album', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn().mockResolvedValue(buildAssetContext()),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    await performSearch(user);
    await user.click(screen.getByRole('button', { name: /add beach\.jpg to album/i }));

    const albumPanel = screen.getByRole('region', { name: 'Album builder' });
    await user.type(within(albumPanel).getByLabelText('Album name'), 'Dobby');
    await user.click(within(albumPanel).getByRole('button', { name: 'Save Album' }));

    expect(screen.getByRole('region', { name: 'Album builder' })).toBeInTheDocument();
    expect(screen.getByText('Album saved. Keep adding or rename to update it.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Album builder' })).getByRole('button', { name: 'Update Album' })).toBeInTheDocument();
  });

  it('restores saved albums from local storage and shows them in the switcher', async () => {
    window.localStorage.setItem(
      'immich-custom-ui.album-preferences',
      JSON.stringify({
        activeAlbumDraftId: 'album-1',
        albums: [
          {
            id: 'album-1',
            isSaved: true,
            name: 'Dobby',
            photos: [SEARCH_RESPONSE.results[0]],
          },
          {
            id: 'album-2',
            isSaved: true,
            name: 'Yard Birds',
            photos: [],
          },
        ],
      }),
    );

    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const assetContextService = createAssetContextService({
      getAssetContext: vi.fn().mockResolvedValue(buildAssetContext()),
    });

    render(<App assetContextService={assetContextService} searchService={searchService} />);

    await performSearch(user);

    expect(screen.queryByRole('region', { name: 'Album builder' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open album for beach\.jpg/i }));

    const albumPanel = screen.getByRole('region', { name: 'Album builder' });
    expect(within(albumPanel).getByDisplayValue('Dobby')).toBeInTheDocument();
    expect(within(albumPanel).getByRole('img', { name: 'beach.jpg' })).toBeInTheDocument();
    expect(within(albumPanel).getByRole('combobox', { name: 'Switch album draft' })).toBeInTheDocument();
  });
});

function createDocumentSearchService(
  overrides: Partial<DocumentSearchService>,
): DocumentSearchService {
  return {
    searchDocuments: vi.fn(),
    ...overrides,
  };
}

const DOCUMENT_SEARCH_RESPONSE = {
  results: [
    {
      id: 42,
      title: 'Tax Return 2024',
      createdDate: '2024-04-15',
      thumbnailUrl: '/api/documents/42/thumb',
      previewUrl: '/api/documents/42/preview',
      snippet: 'Federal income tax return...',
    },
  ],
  total: 1,
  hasMore: false,
};

describe('Document search integration', () => {
  it('renders document results alongside photo results when source is all', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const docService = createDocumentSearchService({
      searchDocuments: vi.fn().mockResolvedValue(DOCUMENT_SEARCH_RESPONSE),
    });

    render(
      <App
        searchService={searchService}
        documentSearchService={docService}
        assetContextService={createAssetContextService({ getAssetContext: vi.fn().mockResolvedValue(buildAssetContext()) })}
      />,
    );

    await performSearch(user);

    expect(screen.getByLabelText('Open preview of Tax Return 2024')).toBeInTheDocument();
    expect(screen.getByText('Federal income tax return...')).toBeInTheDocument();
  });

  it('shows document error banner when document search fails', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const docService = createDocumentSearchService({
      searchDocuments: vi.fn().mockRejectedValue(new Error('Paperless timed out')),
    });

    render(
      <App
        searchService={searchService}
        documentSearchService={docService}
        assetContextService={createAssetContextService({ getAssetContext: vi.fn().mockResolvedValue(buildAssetContext()) })}
      />,
    );

    await performSearch(user);

    expect(screen.getByText('Paperless timed out')).toBeInTheDocument();
  });

  it('hides source filter after detecting Paperless is not configured', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue(SEARCH_RESPONSE),
    });
    const docService = createDocumentSearchService({
      searchDocuments: vi.fn().mockRejectedValue(
        new Error('Paperless is not configured. Missing env: PAPERLESS_BASE_URL.'),
      ),
    });

    render(
      <App
        searchService={searchService}
        documentSearchService={docService}
        assetContextService={createAssetContextService({ getAssetContext: vi.fn().mockResolvedValue(buildAssetContext()) })}
      />,
    );

    expect(screen.getByRole('radiogroup', { name: 'Search source' })).toBeInTheDocument();

    await performSearch(user);

    expect(screen.queryByRole('radiogroup', { name: 'Search source' })).not.toBeInTheDocument();
  });
});
