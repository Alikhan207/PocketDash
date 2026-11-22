'use client';

import { useEffect, useId, useRef, useState } from 'react';

export interface SearchInputProps {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export default function SearchInput({
  value,
  onChange,
  label = 'Search',
  placeholder = 'Search',
  debounceMs = 300,
  className = '',
}: SearchInputProps) {
  const inputId = useId();
  const [draft, setDraft] = useState<string>(value ?? '');
  const lastSent = useRef<string>(value ?? '');
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Follow external value changes, ignoring the echo of our own debounced emits.
  useEffect(() => {
    if (value !== undefined && value !== lastSent.current) {
      lastSent.current = value;
      setDraft(value);
    }
  }, [value]);

  // Debounce emitting the typed text to the parent.
  useEffect(() => {
    if (draft === lastSent.current) return;
    const timer = setTimeout(() => {
      lastSent.current = draft;
      onChangeRef.current(draft);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [draft, debounceMs]);

  const handleClear = () => {
    setDraft('');
    lastSent.current = '';
    onChangeRef.current('');
  };

  return (
    <div data-nexen-component="nx_components_SearchInput" className={`relative w-full max-w-sm min-w-0 ${className}`}>
      <label htmlFor={inputId} className="sr-only" data-nexen-id="nx-bfc569e6-0">
        {label}
      </label>

      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground" data-nexen-id="nx-bfc569e6-1">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
          className="h-4 w-4"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      </span>

      <input
        id={inputId}
        type="search"
        role="searchbox"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        autoComplete="off"
        className="h-10 w-full min-w-0 rounded-[var(--radius)] border border-input bg-background pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
       data-nexen-id="nx-bfc569e6-2"/>

      {draft.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute inset-y-0 right-2 my-auto flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
         data-nexen-id="nx-bfc569e6-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}