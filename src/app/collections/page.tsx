'use client';

import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import PageHeader from '@/components/PageHeader';
import CollectionsTable from '@/components/CollectionsTable';
import InvoiceSearchSortBar from '@/components/InvoiceSearchSortBar';
import ReminderActions from '@/components/ReminderActions';
import { createInvoiceFollowUp, getCollections, getCustomers, updateInvoice } from '@/lib/api';

type Rows = ComponentProps<typeof CollectionsTable>['rows'];
type CollectionRow = NonNullable<Rows>[number];
type ApiCollection = Awaited<ReturnType<typeof getCollections>>[number];
type Draft = Awaited<ReturnType<typeof createInvoiceFollowUp>>;

const toCollectionRow = (r: ApiCollection): CollectionRow => ({
  invoiceId: r.invoice_id,
  customerName: r.customer_name,
  invoiceNumber: r.invoice_number,
  outstandingBalance: r.outstanding_amount,
  dueDate: r.due_date,
  expectedCollectionDate: r.expected_collection_date,
  daysOverdue: r.days_overdue,
  isOverdue: r.is_overdue,
  lastFollowUpSentAt: r.last_follow_up_sent_at,
});

export default function CollectionsPage() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('outstanding');
  const [rows, setRows] = useState<Rows>(null);
  const [customers, setCustomers] = useState<Awaited<ReturnType<typeof getCustomers>>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const safeRows = Array.isArray(rows) ? rows : [];
  const overdue = safeRows.filter((r) => r.isOverdue);
  const selectedRow = safeRows.find((r) => r.invoiceId === selectedId);
  const customerPhone =
    customers.find((c) => c.name === selectedRow?.customerName)?.phone ?? null;

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getCollections({ q: query, sort });
      setRows(data.map(toCollectionRow));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load collections.');
    } finally {
      setIsLoading(false);
    }
  }, [query, sort]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getCustomers()
      .then(setCustomers)
      .catch(() => setCustomers([]));
  }, []);

  const handleSetExpectedDate = async (invoiceId: string, date: string) => {
    try {
      await updateInvoice(invoiceId, { expectedCollectionDate: date });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the expected date.');
    }
  };

  const handleDraft = async () => {
    if (!selectedId || isDrafting) return;
    setIsDrafting(true);
    try {
      const created = await createInvoiceFollowUp(selectedId, {});
      setDraft(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the reminder draft.');
    } finally {
      setIsDrafting(false);
    }
  };

  return (
    <main data-nexen-component="nx_app_collections_page" className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6" data-nexen-id="nx-7571565a-0">
      <PageHeader
        title="Collections"
        description="Overdue invoices first, by outstanding amount and days late."
        actions={null}
        className=""
      />

      <InvoiceSearchSortBar
        query={query}
        sort={sort}
        resultCount={safeRows.length}
        onQueryChange={setQuery}
        onSortChange={setSort}
      />

      {error && (
        <p role="alert" className="rounded-[var(--radius)] border border-border bg-card p-4 text-sm text-destructive" data-nexen-id="nx-7571565a-1">
          {error}
        </p>
      )}

      {isLoading && rows === null ? (
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-7571565a-2">Loading collections…</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card shadow-sm">
          <CollectionsTable rows={rows} onSetExpectedDate={handleSetExpectedDate} />
        </div>
      )}

      <section className="space-y-4 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm" data-nexen-id="nx-7571565a-3">
        <h2 className="text-lg font-semibold" data-nexen-id="nx-7571565a-4">Draft a reminder</h2>
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-7571565a-5">
          Drafts are saved for your review. Opening or copying one does not mark it as sent.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm" data-nexen-id="nx-7571565a-6">
            <span className="text-muted-foreground" data-nexen-id="nx-7571565a-7">Overdue invoice</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="h-11 w-full min-w-0 rounded-[var(--radius)] border border-input bg-background px-3"
             data-nexen-id="nx-7571565a-8">
              <option value="">Select an overdue invoice</option>
              {overdue.map((r) => (
                <option key={r.invoiceId} value={r.invoiceId}>
                  {r.customerName} · {r.invoiceNumber}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleDraft}
            disabled={!selectedId || isDrafting}
            className="h-11 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow disabled:opacity-50"
           data-nexen-id="nx-7571565a-9">
            {isDrafting ? 'Creating…' : 'Create draft'}
          </button>
        </div>
        {draft && (
          <ReminderActions
            followUpId={draft.id}
            body={draft.body}
            customerPhone={customerPhone}
            onSent={() => {
              setDraft(null);
              load();
            }}
          />
        )}
      </section>
    </main>
  );
}