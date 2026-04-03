import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SearchForm } from '../features/search/SearchForm';

describe('SearchForm', () => {
  it('renders a compact search bar with expandable filters', async () => {
    const user = userEvent.setup();
    render(<SearchForm onSearch={vi.fn()} isLoading={false} />);

    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('To')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show filters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show filters' }));

    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
  });

  it('shows validation error for empty query', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchForm onSearch={onSearch} isLoading={false} />);

    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Search query cannot be empty.');
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('shows validation error when start date is after end date', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchForm onSearch={onSearch} isLoading={false} />);

    await user.click(screen.getByRole('button', { name: 'Show filters' }));
    await user.type(screen.getByLabelText('Search'), 'test');
    await user.type(screen.getByLabelText('From'), '2024-12-01');
    await user.type(screen.getByLabelText('To'), '2024-01-01');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Start date must be before end date.');
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('calls onSearch with trimmed query when form is valid', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchForm onSearch={onSearch} isLoading={false} />);

    await user.type(screen.getByLabelText('Search'), '  sunset  ');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalledWith({
      query: 'sunset',
      startDate: undefined,
      endDate: undefined,
      source: 'all',
      documentMode: 'hybrid',
    });
  });

  it('passes date values when provided', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchForm onSearch={onSearch} isLoading={false} />);

    await user.click(screen.getByRole('button', { name: 'Show filters' }));
    await user.type(screen.getByLabelText('Search'), 'hike');
    await user.type(screen.getByLabelText('From'), '2024-01-01');
    await user.type(screen.getByLabelText('To'), '2024-12-31');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalledWith({
      query: 'hike',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      source: 'all',
      documentMode: 'hybrid',
    });
  });

  it('shows "Searching…" on the button when loading', () => {
    render(<SearchForm onSearch={vi.fn()} isLoading={true} />);

    const button = screen.getByRole('button', { name: 'Searching…' });
    expect(button).toHaveTextContent('Searching…');
    expect(button).toBeDisabled();
  });

  it('shows document mode pills when source filter is visible and includes documents', async () => {
    const user = userEvent.setup();
    render(<SearchForm onSearch={vi.fn()} isLoading={false} showSourceFilter={true} />);

    // Default source is 'all', so doc mode pills should appear
    expect(screen.getByLabelText('Document search mode')).toBeInTheDocument();
    expect(screen.getByText('Hybrid')).toBeInTheDocument();
    expect(screen.getByText('Keyword')).toBeInTheDocument();
    expect(screen.getByText('Semantic')).toBeInTheDocument();

    // Switch to photos-only — doc mode pills should disappear
    await user.click(screen.getByText('Photos'));
    expect(screen.queryByLabelText('Document search mode')).not.toBeInTheDocument();
  });

  it('passes selected document mode to onSearch', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchForm onSearch={onSearch} isLoading={false} showSourceFilter={true} />);

    await user.type(screen.getByLabelText('Search'), 'receipt');
    await user.click(screen.getByText('Keyword'));
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ documentMode: 'keyword' }),
    );
  });

  it('does not include documentMode when source is photos-only', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchForm onSearch={onSearch} isLoading={false} showSourceFilter={true} />);

    await user.type(screen.getByLabelText('Search'), 'sunset');
    await user.click(screen.getByText('Photos'));
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ documentMode: undefined }),
    );
  });
});
