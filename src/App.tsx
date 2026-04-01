import { useState, useMemo } from 'react';
import type { SearchRequest, SearchResult } from './types';
import { MockSearchService } from './services';
import type { SearchService } from './services';
import { SearchForm, SearchResults } from './features/search';
import { EmptyState, ErrorBanner } from './components';
import styles from './App.module.css';

type SearchState = 'idle' | 'loading' | 'success' | 'error';

function App() {
  const searchService: SearchService = useMemo(() => new MockSearchService(), []);

  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<SearchState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSearch = async (request: SearchRequest) => {
    setState('loading');
    setErrorMsg('');
    try {
      const response = await searchService.search(request);
      setResults(response.results);
      setTotal(response.total);
      setState('success');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMsg(message);
      setState('error');
    }
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>Immich Search</h1>
      </header>

      <main className={styles.main}>
        <SearchForm onSearch={handleSearch} isLoading={state === 'loading'} />

        {state === 'error' && <ErrorBanner message={errorMsg} />}

        {state === 'loading' && (
          <EmptyState message="Searching…" />
        )}

        {state === 'success' && results.length === 0 && (
          <EmptyState message="No results found. Try a different query or date range." />
        )}

        {state === 'success' && results.length > 0 && (
          <SearchResults results={results} total={total} />
        )}

        {state === 'idle' && (
          <EmptyState message="Enter a search query to find your photos." />
        )}
      </main>
    </div>
  );
}

export default App;
