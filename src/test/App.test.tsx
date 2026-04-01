import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { SearchService } from '../services';

function createSearchService(overrides: Partial<SearchService>): SearchService {
  return {
    search: vi.fn(),
    ...overrides,
  };
}

describe('App', () => {
  it('renders a successful search result path', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockResolvedValue({
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
      }),
    });

    render(<App searchService={searchService} />);

    await user.type(screen.getByLabelText('Search'), 'beach');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('beach.jpg')).toBeInTheDocument();
    expect(screen.getByText('1 result found')).toBeInTheDocument();
  });

  it('renders a friendly error when the backend search fails', async () => {
    const user = userEvent.setup();
    const searchService = createSearchService({
      search: vi.fn().mockRejectedValue(new Error('Immich search is unavailable right now.')),
    });

    render(<App searchService={searchService} />);

    await user.type(screen.getByLabelText('Search'), 'beach');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Immich search is unavailable right now.');
  });
});
