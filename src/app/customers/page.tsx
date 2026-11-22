
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCustomers } from '@/lib/api';
import CustomersTable from '@/components/CustomersTable';
import PageHeader from '@/components/PageHeader';
import SearchInput from '@/components/SearchInput';
import { Button } from '@/components/ui/button';

type CustomerRow = Parameters<typeof CustomersTable>[0]['customers'][number];

const MAX_SEARCH = 100;

export default function CustomersPage() {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const trimmed = query.trim();
  const tooLong = query.length > MAX_SEARCH;

  useEffect(() => {
    if (tooLong) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getCustomers(trimmed ? { q: trimmed } : {})
      .then((data) => {
        if (!cancelled) setCustomers(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setError('Customers could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trimmed, tooLong, attempt]);

  let body;
  if (tooLong) {
    body = (
      <p role="alert" className="text-sm text-destructive" data-nexen-id="nx-c4f12caf-0">
        Search is limited to 100 characters.
      </p>
    );
  } else if (isLoading) {
    body = (
      <div role="status" className="rounded-[var(--radius)] border bg-card p-6 text-sm text-muted-foreground">
        Loading customers…
      </div>
    );
  } else if (error) {
    body = (
      <div className="flex flex-col gap-3 rounded-[var(--radius)] border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-sm text-destructive" data-nexen-id="nx-c4f12caf-1">{error}</p>
        <Button variant="outline" onClick={() => setAttempt((a) => a + 1)} data-nexen-id="nx-c4f12caf-2">
          Retry
        </Button>
      </div>
    );
  } else if (customers.length === 0 && !trimmed) {
    body = (
      <div className="flex flex-col items-start gap-3 rounded-[var(--radius)] border bg-card p-6">
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-c4f12caf-3">No customers saved yet.</p>
        <Button asChild data-nexen-id="nx-c4f12caf-4">
          <Link href="/customers/new" data-nexen-id="nx-c4f12caf-5">New customer</Link>
        </Button>
      </div>
    );
  } else {
    body = (
      <div className="w-full min-w-0 overflow-x-auto">
        <CustomersTable
          customers={customers}
          emptyMessage={trimmed ? 'No customers match this search.' : 'No customers saved yet.'}
        />
      </div>
    );
  }

  return (
    <div data-nexen-component="nx_app_customers_page" className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <PageHeader
        title="Customers"
        description="Balances are based on entered invoice and payment records, not bank-verified money."
        actions={
          <Button asChild data-nexen-id="nx-c4f12caf-6">
            <Link href="/customers/new" data-nexen-id="nx-c4f12caf-7">New customer</Link>
          </Button>
        }
        className=""
      />
      <SearchInput
        value={query}
        onChange={setQuery}
        label="Search customers"
        placeholder="Search by name"
        debounceMs={300}
        className="w-full max-w-md"
      />
      {body}
    </div>
  );
}