import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
  it('renders result cards with titles and descriptions', () => {
    render(<SearchResults results={SAMPLE_RESULTS} total={2} />);

    expect(screen.getByText('Sunset at the beach')).toBeInTheDocument();
    expect(screen.getByText('Mountain hike')).toBeInTheDocument();
    expect(screen.getByText('Golden hour at the coast.')).toBeInTheDocument();
    expect(screen.getByText('2 results found')).toBeInTheDocument();
  });

  it('renders images with alt text', () => {
    render(<SearchResults results={SAMPLE_RESULTS} total={2} />);

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute('alt', 'Sunset at the beach');
  });

  it('uses singular "result" for count of 1', () => {
    render(<SearchResults results={[SAMPLE_RESULTS[0]]} total={1} />);

    expect(screen.getByText('1 result found')).toBeInTheDocument();
  });
});
