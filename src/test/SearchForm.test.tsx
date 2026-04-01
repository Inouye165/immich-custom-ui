import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SearchForm } from '../features/search/SearchForm';

describe('SearchForm', () => {
  it('renders all fields and the submit button', () => {
    render(<SearchForm onSearch={vi.fn()} isLoading={false} />);

    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
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
    });
  });

  it('passes date values when provided', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchForm onSearch={onSearch} isLoading={false} />);

    await user.type(screen.getByLabelText('Search'), 'hike');
    await user.type(screen.getByLabelText('From'), '2024-01-01');
    await user.type(screen.getByLabelText('To'), '2024-12-31');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalledWith({
      query: 'hike',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    });
  });

  it('shows "Searching…" on the button when loading', () => {
    render(<SearchForm onSearch={vi.fn()} isLoading={true} />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Searching…');
    expect(button).toBeDisabled();
  });
});
