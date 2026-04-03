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
    });
  });

  it('shows "Searching…" on the button when loading', () => {
    render(<SearchForm onSearch={vi.fn()} isLoading={true} />);

    const button = screen.getByRole('button', { name: 'Searching…' });
    expect(button).toHaveTextContent('Searching…');
    expect(button).toBeDisabled();
  });

  it('hides the source filter by default', () => {
    render(<SearchForm onSearch={vi.fn()} isLoading={false} />);

    expect(screen.queryByRole('radiogroup', { name: 'Search source' })).not.toBeInTheDocument();
  });

  it('renders source filter radios when showSourceFilter is true', () => {
    render(<SearchForm onSearch={vi.fn()} isLoading={false} showSourceFilter={true} />);

    const group = screen.getByRole('radiogroup', { name: 'Search source' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Photos' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Documents' })).not.toBeChecked();
  });

  it('hides date filters when Documents source is selected', async () => {
    const user = userEvent.setup();
    render(<SearchForm onSearch={vi.fn()} isLoading={false} showSourceFilter={true} />);

    await user.click(screen.getByRole('button', { name: 'Show filters' }));
    expect(screen.getByLabelText('From')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Documents' }));
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('To')).not.toBeInTheDocument();
  });

  it('submits the selected source value', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchForm onSearch={onSearch} isLoading={false} showSourceFilter={true} />);

    await user.click(screen.getByRole('radio', { name: 'Documents' }));
    await user.type(screen.getByLabelText('Search'), 'invoice');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalledWith({
      query: 'invoice',
      startDate: undefined,
      endDate: undefined,
      source: 'documents',
    });
  });
});
