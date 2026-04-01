import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SearchRequest } from '../../types';
import styles from './SearchForm.module.css';

interface SearchFormProps {
  onSearch: (request: SearchRequest) => void;
  isLoading: boolean;
}

export function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

  const validate = (): string | null => {
    const trimmed = query.trim();
    if (!trimmed) return 'Search query cannot be empty.';
    if (startDate && endDate && startDate > endDate) {
      return 'Start date must be before end date.';
    }
    return null;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    onSearch({
      query: query.trim(),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} role="search">
      <div className={styles.field}>
        <label htmlFor="search-query">Search</label>
        <input
          id="search-query"
          type="text"
          placeholder="e.g. sunset, family, hike…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className={styles.dateRow}>
        <div className={styles.field}>
          <label htmlFor="start-date">From</label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="end-date">To</label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={isLoading} className={styles.button}>
        {isLoading ? 'Searching…' : 'Search'}
      </button>
    </form>
  );
}
