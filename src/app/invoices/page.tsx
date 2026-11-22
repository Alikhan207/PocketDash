'use client';

import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import InvoiceSearchSortBar from '@/components/InvoiceSearchSortBar';
import InvoiceTable from '@/components/InvoiceTable';
import { getInvoices } from '@/lib/api';

type InvoiceList = Awaited<ReturnType<typeof getInvoices>>;

const MAX_QUERY_LENGTH = 100;
const SORT_OPTIONS = ['due_date', 'outstanding', 'days_overdue'];

export default function InvoicesPage() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('due_date');
  const [invoices, setInvoices] = useState<InvoiceList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (query.length > MAX_QUERY_LENGTH) return;
    if (!SORT_OPTIONS.includes(sort)) return;
    let active = true;
    setIsLoading(true);
    setError(null);
    getInvoices({ q: query.trim() || undefined, sort, filter: 'all' })
      .then((data) => {
        if (active) setInvoices(data);
      })
      .catch(() => {
        if (active) setError('Invoices could not load. Please try again.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, sort, reloadKey]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setQueryError(
      value.length > MAX_QUERY_LENGTH
        ? 'Search is limited to 100 characters. Shorten it to keep searching.'
        : null,
    );
  }

  const rows = invoices ?? [];
  const receivable = rows.filter((r) => r.status !== 'draft' && r.status !== 'cancelled');
  const overdue = receivable.filter((r) => r.is_overdue && r.outstanding_balance > 0);
  const notDue = receivable.filter((r) => !r.is_overdue && r.outstanding_balance > 0);
  const paid = receivable.filter((r) => r.outstanding_balance <= 0);

  const sections = [
    { key: 'overdue', title: 'Overdue', rows: overdue, empty: 'No overdue invoices.' },
    { key: 'not-due', title: 'Not yet due', rows: notDue, empty: 'No invoices waiting for payment.' },
    { key: 'paid', title: 'Paid', rows: paid, empty: 'No paid invoices yet.' },
    { key: 'draft', title: 'Drafts', rows: rows.filter(r=>r.status==='draft'), empty: 'No drafts.' },
    { key: 'cancelled', title: 'Cancelled', rows: rows.filter(r=>r.status==='cancelled'), empty: 'No cancelled invoices.' },
  ];

  return (
    <div data-nexen-component="nx_app_invoices_page" className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Invoices"
        description="Search and sort every invoice. Overdue balances are listed first."
        actions={
          <Link
            href="/invoices/new"
            className="inline-flex h-11 items-center justify-center rounded-[999px] bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-md"
           data-nexen-id="nx-a5b56746-0">
            New invoice
          </Link>
        }
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      />

      <InvoiceSearchSortBar
        query={query}
        sort={sort}
        resultCount={rows.length}
        onQueryChange={handleQueryChange}
        onSortChange={(value) => setSort(value)}
      />

      {queryError && (
        <p role="alert" className="text-sm text-destructive" data-nexen-id="nx-a5b56746-1">
          {queryError}
        </p>
      )}

      {error && (
        <div className="flex flex-col gap-3 rounded-[var(--radius)] border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 text-sm" data-nexen-id="nx-a5b56746-2">{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex h-10 items-center justify-center rounded-[999px] border px-4 text-sm font-semibold"
           data-nexen-id="nx-a5b56746-3">
            Retry
          </button>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded-[var(--radius)] bg-muted" />
          ))}
        </div>
      )}

      {!isLoading && !error && invoices !== null && rows.length === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-[var(--radius)] border bg-card p-6">
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-a5b56746-4">
            {query ? 'No invoices match this search.' : 'No invoices yet.'}
          </p>
          {!query && (
            <Link
              href="/invoices/new"
              className="inline-flex h-10 items-center justify-center rounded-[999px] bg-primary px-4 text-sm font-semibold text-primary-foreground"
             data-nexen-id="nx-a5b56746-5">
              New invoice
            </Link>
          )}
        </div>
      )}

      {!isLoading &&
        !error &&
        sections.map((section) => (
          <section key={section.key} className="space-y-3" data-nexen-id="nx-a5b56746-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold" data-nexen-id="nx-a5b56746-7">
              {section.title}
              <span className="rounded-[999px] bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground" data-nexen-id="nx-a5b56746-8">
                {section.rows.length}
              </span>
            </h2>
            {section.rows.length > 0 ? (
              <div className="w-full overflow-x-auto rounded-[var(--radius)] border bg-card">
                <InvoiceTable
                  invoices={section.rows.map((r) => ({
                    ...r,
                    customerName: r.customer_name,
                    outstandingBalance: r.outstanding_balance,
                    daysOverdue: r.days_overdue,
                  }))}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground" data-nexen-id="nx-a5b56746-9">{section.empty}</p>
            )}
          </section>
        ))}
    </div>
  );
}