import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DocumentResults } from '../features/documents/DocumentResults';
import type { DocumentResult } from '../types';

const SAMPLE_DOCS: DocumentResult[] = [
  {
    id: 1,
    title: 'Tax Return 2024',
    createdDate: '2024-04-15',
    thumbnailUrl: '/api/documents/1/thumb',
    previewUrl: '/api/documents/1/preview',
    snippet: 'Federal income tax...',
  },
  {
    id: 2,
    title: 'Lease Agreement',
    createdDate: '2024-02-01',
    thumbnailUrl: '/api/documents/2/thumb',
    previewUrl: '/api/documents/2/preview',
  },
];

describe('DocumentResults', () => {
  it('renders document count and cards', () => {
    render(
      <DocumentResults
        results={SAMPLE_DOCS}
        total={2}
        hasMore={false}
        isLoadingMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    const summary = screen.getByText((_content, element) =>
      element?.tagName === 'P' && element.textContent === '2 documents found',
    );
    expect(summary).toBeInTheDocument();
    expect(
      screen.getByLabelText('Open preview of Tax Return 2024'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Open preview of Lease Agreement'),
    ).toBeInTheDocument();
  });

  it('renders singular count for one result', () => {
    render(
      <DocumentResults
        results={[SAMPLE_DOCS[0]]}
        total={1}
        hasMore={false}
        isLoadingMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    const summary = screen.getByText((_content, element) =>
      element?.tagName === 'P' && element.textContent === '1 document found',
    );
    expect(summary).toBeInTheDocument();
  });

  it('renders a snippet when available', () => {
    render(
      <DocumentResults
        results={SAMPLE_DOCS}
        total={2}
        hasMore={false}
        isLoadingMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.getByText('Federal income tax...')).toBeInTheDocument();
  });

  it('shows load more button when hasMore is true', () => {
    render(
      <DocumentResults
        results={SAMPLE_DOCS}
        total={25}
        hasMore={true}
        isLoadingMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Load more documents' }),
    ).toBeInTheDocument();
  });

  it('hides load more button when hasMore is false', () => {
    render(
      <DocumentResults
        results={SAMPLE_DOCS}
        total={2}
        hasMore={false}
        isLoadingMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Load more documents' }),
    ).not.toBeInTheDocument();
  });

  it('shows loading state on load more button', () => {
    render(
      <DocumentResults
        results={SAMPLE_DOCS}
        total={25}
        hasMore={true}
        isLoadingMore={true}
        onLoadMore={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Loading…' });
    expect(button).toBeDisabled();
  });

  it('calls onLoadMore when button is clicked', async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(
      <DocumentResults
        results={SAMPLE_DOCS}
        total={25}
        hasMore={true}
        isLoadingMore={false}
        onLoadMore={onLoadMore}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Load more documents' }),
    );
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it('opens preview in new tab via link', () => {
    render(
      <DocumentResults
        results={SAMPLE_DOCS}
        total={2}
        hasMore={false}
        isLoadingMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    const link = screen.getByLabelText('Open preview of Tax Return 2024');
    expect(link).toHaveAttribute('href', '/api/documents/1/preview');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders select checkboxes when onDeleteDocuments is provided', () => {
    render(
      <DocumentResults
        results={SAMPLE_DOCS}
        total={2}
        hasMore={false}
        isLoadingMore={false}
        onLoadMore={vi.fn()}
        onDeleteDocuments={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Select Tax Return 2024')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Lease Agreement')).toBeInTheDocument();
  });

  it('does not render checkboxes when onDeleteDocuments is not provided', () => {
    render(
      <DocumentResults
        results={SAMPLE_DOCS}
        total={2}
        hasMore={false}
        isLoadingMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Select Tax Return 2024')).not.toBeInTheDocument();
  });

  it('shows delete button after selecting documents', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <DocumentResults
        results={SAMPLE_DOCS}
        total={2}
        hasMore={false}
        isLoadingMore={false}
        onLoadMore={vi.fn()}
        onDeleteDocuments={onDelete}
      />,
    );

    await user.click(screen.getByLabelText('Select Tax Return 2024'));
    const deleteBtn = screen.getByRole('button', { name: /Delete 1 selected/ });
    expect(deleteBtn).toBeInTheDocument();

    await user.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith([1]);
  });

  it('allows selecting multiple documents for deletion', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <DocumentResults
        results={SAMPLE_DOCS}
        total={2}
        hasMore={false}
        isLoadingMore={false}
        onLoadMore={vi.fn()}
        onDeleteDocuments={onDelete}
      />,
    );

    await user.click(screen.getByLabelText('Select Tax Return 2024'));
    await user.click(screen.getByLabelText('Select Lease Agreement'));
    const deleteBtn = screen.getByRole('button', { name: /Delete 2 selected/ });
    await user.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith([1, 2]);
  });

  it('disables delete button when isDeleting is true', async () => {
    const user = userEvent.setup();
    render(
      <DocumentResults
        results={SAMPLE_DOCS}
        total={2}
        hasMore={false}
        isLoadingMore={false}
        isDeleting={true}
        onLoadMore={vi.fn()}
        onDeleteDocuments={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText('Select Tax Return 2024'));
    const deleteBtn = screen.getByRole('button', { name: /Deleting/ });
    expect(deleteBtn).toBeDisabled();
  });
});
