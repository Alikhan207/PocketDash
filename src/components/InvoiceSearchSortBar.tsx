'use client';

import { useEffect, useState, type ChangeEvent } from 'react';

const SEARCH_MAX_LENGTH = 100;

const SORT_OPTIONS = [
  { value: 'customer', label: 'Customer name' },
  { value: 'outstanding', label: 'Outstanding amount' },
  { value: 'due_date', label: 'Due date' },
] as const;

export type InvoiceSortValue = (typeof SORT_OPTIONS)[number]['value'];

const SEARCH_ERROR = 'Search is limited to 100 characters. Shorten it to keep searching.';
const SORT_ERROR = 'Choose a sort option: customer, outstanding amount, or due date.';

interface InvoiceSearchSortBarProps {
  query?: string;
  sort?: string;
  resultCount?: number;
  onQueryChange?: (query: string) => void;
  onSortChange?: (sort: InvoiceSortValue) => void;
}

export default function InvoiceSearchSortBar({
  query = '',
  sort = 'due_date',
  resultCount,
  onQueryChange,
  onSortChange,
}: InvoiceSearchSortBarProps) {
  const [text, setText] = useState<string>(query);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sortError, setSortError] = useState<string | null>(null);

  useEffect(() => {
    setText(query);
  }, [query]);

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setText(value);
    if (value.length > SEARCH_MAX_LENGTH) {
      setSearchError(SEARCH_ERROR);
      return;
    }
    setSearchError(null);
    onQueryChange?.(value.trim());
  }

  function handleClear() {
    setText('');
    setSearchError(null);
    onQueryChange?.('');
  }

  function handleSortChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    const option = SORT_OPTIONS.find((o) => o.value === value);
    if (!option) {
      setSortError(SORT_ERROR);
      return;
    }
    setSortError(null);
    onSortChange?.(option.value);
  }

  const hasText = text.trim() !== '';
  const showNoMatch = hasText && resultCount === 0;

  return (
    <section data-nexen-component="nx_components_InvoiceSearchSortBar"
      aria-label="Search and sort invoices"
      className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-start"
     data-nexen-id="nx-cd8623c2-0">
      <div className="min-w-0 flex-1">
        <label htmlFor="invoice-search" className="sr-only" data-nexen-id="nx-cd8623c2-1">
          Search invoices
        </label>
        <div className="flex items-center gap-2">
          <input
            id="invoice-search"
            type="search"
            value={text}
            onChange={handleSearchChange}
            placeholder="Search invoice number or customer"
            aria-invalid={searchError !== null}
            aria-describedby={searchError ? 'invoice-search-error' : undefined}
            className="h-10 w-full min-w-0 rounded-[var(--radius)] border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
           data-nexen-id="nx-cd8623c2-2"/>
          {hasText && (
            <button
              type="button"
              onClick={handleClear}
              className="h-10 shrink-0 rounded-full border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
             data-nexen-id="nx-cd8623c2-3">
              Clear
            </button>
          )}
        </div>
        {searchError && (
          <p id="invoice-search-error" role="alert" className="mt-1 text-sm text-destructive" data-nexen-id="nx-cd8623c2-4">
            {searchError}
          </p>
        )}
        {showNoMatch && (
          <p className="mt-1 text-sm text-muted-foreground" data-nexen-id="nx-cd8623c2-5">
            No invoices match &ldquo;{text.trim()}&rdquo;.
          </p>
        )}
      </div>

      <div className="w-full sm:w-56">
        <label htmlFor="invoice-sort" className="mb-1 block text-sm font-medium text-muted-foreground" data-nexen-id="nx-cd8623c2-6">
          Sort by
        </label>
        <select
          id="invoice-sort"
          value={sort}
          onChange={handleSortChange}
          aria-invalid={sortError !== null}
          aria-describedby={sortError ? 'invoice-sort-error' : undefined}
          className="h-10 w-full rounded-[var(--radius)] border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
         data-nexen-id="nx-cd8623c2-7">
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {sortError && (
          <p id="invoice-sort-error" role="alert" className="mt-1 text-sm text-destructive" data-nexen-id="nx-cd8623c2-8">
            {sortError}
          </p>
        )}
      </div>
    </section>
  );
}