import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { AssetContextService, SearchService } from '../services';

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

function buildAssetContext(overrides: Record<string, unknown> = {}) {
  return {
    asset: {
      id: '1',
      title: 'beach.jpg',
      mediaType: 'Photo',
      imageUrl: '/api/assets/1/thumbnail?size=fullsize',
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

    expect(await screen.findByText('beach.jpg')).toBeInTheDocument();
    expect(screen.getByText('1 result found')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The Hearthside Archive' })).toBeInTheDocument();
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

    expect(await screen.findByText('No GPS location available.')).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: 'Add image' }));
    await user.click(screen.getByRole('button', { name: /use beach.jpg in header/i }));
    await user.clear(screen.getByLabelText('Archive name'));
    await user.type(screen.getByLabelText('Archive name'), 'Yellowstone Keepsakes');

    expect(screen.getByRole('heading', { name: 'Yellowstone Keepsakes' })).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove beach.jpg from header/i })).toBeInTheDocument();
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
});
