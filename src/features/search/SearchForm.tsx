import { useState } from 'react';
import type { FormEvent } from 'react';
import type { DocumentSearchMode, SearchRequest, SearchSource } from '../../types';
import styles from './SearchForm.module.css';

interface SearchFormProps {
  onSearch: (request: SearchRequest) => void;
  isLoading: boolean;
  showSourceFilter?: boolean;
}

const SOURCE_OPTIONS: { value: SearchSource; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'photos', label: 'Photos' },
  { value: 'documents', label: 'Documents' },
];

const DOC_MODE_OPTIONS: { value: DocumentSearchMode; label: string }[] = [
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'keyword', label: 'Keyword' },
  { value: 'semantic', label: 'Semantic' },
];

export function SearchForm({ onSearch, isLoading, showSourceFilter = false }: SearchFormProps) {
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [source, setSource] = useState<SearchSource>('all');
  const [documentMode, setDocumentMode] = useState<DocumentSearchMode>('hybrid');
  const [error, setError] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const panelId = 'search-advanced-filters';
  const showDateFilters = source !== 'documents';
  const searchesDocs = source === 'all' || source === 'documents';

  const validate = (): string | null => {
    const trimmed = query.trim();
    if (!trimmed) return 'Search query cannot be empty.';
    if (showDateFilters && startDate && endDate && startDate > endDate) {
      return 'Start date must be before end date.';
    }
    return null;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      if (showDateFilters) setIsExpanded(true);
      return;
    }
    setError('');
    onSearch({
      query: query.trim(),
      startDate: showDateFilters && startDate ? startDate : undefined,
      endDate: showDateFilters && endDate ? endDate : undefined,
      source,
      documentMode: searchesDocs ? documentMode : undefined,
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} role="search">
      <div className={styles.shell}>
        <div className={styles.searchRow}>
          <div className={styles.queryField}>
            <label className={styles.srOnly} htmlFor="search-query">
              Search
            </label>
            <input
              id="search-query"
              type="text"
              placeholder="Search the archive by moment, place, or story"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </div>

          {showDateFilters && (
            <button
              type="button"
              className={styles.filterToggle}
              aria-controls={panelId}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Hide filters' : 'Show filters'}
              onClick={() => setIsExpanded((current) => !current)}
            >
              <span className={styles.chevronPair} aria-hidden="true">
                <span className={styles.chevron} />
                <span className={styles.chevron} />
              </span>
            </button>
          )}

          <button type="submit" disabled={isLoading} className={styles.button}>
            {isLoading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {showSourceFilter && (
          <fieldset className={styles.sourceFilter} role="radiogroup" aria-label="Search source">
            <legend className={styles.srOnly}>Search source</legend>
            {SOURCE_OPTIONS.map((opt) => (
              <label key={opt.value} className={`${styles.sourceOption} ${source === opt.value ? styles.sourceOptionActive : ''}`}>
                <input
                  type="radio"
                  name="search-source"
                  value={opt.value}
                  checked={source === opt.value}
                  onChange={() => setSource(opt.value)}
                  className={styles.srOnly}
                />
                {opt.label}
              </label>
            ))}
          </fieldset>
        )}

        {showSourceFilter && searchesDocs && (
          <fieldset className={styles.docModeFilter} role="radiogroup" aria-label="Document search mode">
            <legend className={styles.srOnly}>Document search mode</legend>
            {DOC_MODE_OPTIONS.map((opt) => (
              <label key={opt.value} className={`${styles.docModeOption} ${documentMode === opt.value ? styles.docModeOptionActive : ''}`}>
                <input
                  type="radio"
                  name="doc-search-mode"
                  value={opt.value}
                  checked={documentMode === opt.value}
                  onChange={() => setDocumentMode(opt.value)}
                  className={styles.srOnly}
                />
                {opt.label}
              </label>
            ))}
          </fieldset>
        )}
      </div>

      {showDateFilters && isExpanded && (
        <div className={styles.advancedPanel} id={panelId}>
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
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
