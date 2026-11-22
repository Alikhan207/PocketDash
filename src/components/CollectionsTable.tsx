
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import {inr} from '@/lib/finance';

export interface CollectionRow {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  outstandingBalance: number | string;
  dueDate: string;
  daysOverdue: number;
  expectedCollectionDate: string | null;
  lastFollowUpSentAt: string | null;
  isOverdue: boolean;
}

interface CollectionsTableProps {
  rows?: CollectionRow[] | null;
  onSetExpectedDate?: (invoiceId: string, date: string) => Promise<void> | void;
}

function formatMoney(value: number | string): string {
  const n = typeof value === 'number' ? value : Number(value);
  return inr(Number.isFinite(n)?n:0);
}

function formatDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

function sortRows(rows: CollectionRow[]): CollectionRow[] {
  return [...rows].sort((a, b) => {
    const byAmount = Number(b.outstandingBalance) - Number(a.outstandingBalance);
    if (byAmount !== 0) return byAmount;
    return b.daysOverdue - a.daysOverdue;
  });
}

export default function CollectionsTable({ rows, onSetExpectedDate }: CollectionsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const list = Array.isArray(rows) ? rows : [];

  const startEdit = (row: CollectionRow) => {
    setEditingId(row.invoiceId);
    setDraftDate(formatDay(row.expectedCollectionDate) ?? '');
    setError(null);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>, row: CollectionRow) => {
    event.preventDefault();
    if (!draftDate) {
      setError('Choose an expected collection date.');
      return;
    }
    if (Number.isNaN(Date.parse(draftDate))) {
      setError('Enter a valid date.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSetExpectedDate?.(row.invoiceId, draftDate);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the date.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-sm" data-nexen-id="nx-3e6db309-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm sm:min-w-[640px]" data-nexen-id="nx-3e6db309-1">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground" data-nexen-id="nx-3e6db309-2">
            <tr data-nexen-id="nx-3e6db309-3">
              <th className="px-2.5 py-3 sm:px-4 font-semibold" data-nexen-id="nx-3e6db309-4">Customer</th>
              <th className="hidden px-2.5 py-3 sm:px-4 font-semibold sm:table-cell" data-nexen-id="nx-3e6db309-5">Invoice</th>
              <th className="px-2.5 py-3 sm:px-4 font-semibold" data-nexen-id="nx-3e6db309-6">Outstanding</th>
              <th className="hidden px-2.5 py-3 sm:px-4 font-semibold sm:table-cell" data-nexen-id="nx-3e6db309-7">Due</th>
              <th className="hidden px-2.5 py-3 sm:px-4 font-semibold sm:table-cell" data-nexen-id="nx-3e6db309-8">Days overdue</th>
              <th className="hidden px-2.5 py-3 sm:px-4 font-semibold sm:table-cell" data-nexen-id="nx-3e6db309-9">Last follow-up</th>
              <th className="px-2.5 py-3 sm:px-4 font-semibold" data-nexen-id="nx-3e6db309-10">Expected date</th>
            </tr>
          </thead>
          <tbody data-nexen-id="nx-3e6db309-11">
            {list.length === 0 && (
              <tr data-nexen-id="nx-3e6db309-12">
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground" data-nexen-id="nx-3e6db309-13">
                  No overdue or unscheduled invoices.
                </td>
              </tr>
            )}
            {list.map((row) => {
              const expected = formatDay(row.expectedCollectionDate ?? (!row.isOverdue ? row.dueDate : null));
              const isEditing = editingId === row.invoiceId;
              return (
                <tr data-nexen-component="nx_components_CollectionsTable" key={row.invoiceId} className="border-t border-border align-top" data-nexen-id="nx-3e6db309-14">
                  <td className="min-w-0 px-2.5 py-3 sm:px-4 font-medium text-foreground" data-nexen-id="nx-3e6db309-15">{row.customerName}<Link href={`/invoices/${row.invoiceId}`} className="mt-1 block whitespace-nowrap font-mono text-xs font-normal text-primary underline sm:hidden">{row.invoiceNumber}</Link></td>
                  <td className="hidden whitespace-nowrap px-2.5 py-3 sm:px-4 sm:table-cell" data-nexen-id="nx-3e6db309-16">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs" data-nexen-id="nx-3e6db309-17"><Link href={`/invoices/${row.invoiceId}`} className="underline">{row.invoiceNumber}</Link></code>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-3 sm:px-4 font-medium" data-nexen-id="nx-3e6db309-18">{formatMoney(row.outstandingBalance)}<span className={`mt-1 block text-xs font-semibold sm:hidden ${row.isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>{row.isOverdue ? `${row.daysOverdue} ${row.daysOverdue === 1 ? 'day' : 'days'} late` : 'Not due'}</span></td>
                  <td className="hidden whitespace-nowrap px-2.5 py-3 sm:px-4 text-muted-foreground sm:table-cell" data-nexen-id="nx-3e6db309-19">{formatDay(row.dueDate)}</td>
                  <td className="hidden px-2.5 py-3 sm:px-4 sm:table-cell" data-nexen-id="nx-3e6db309-20">
                    {row.isOverdue ? (
                      <span className="inline-flex whitespace-nowrap rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive" data-nexen-id="nx-3e6db309-21">
                        {row.daysOverdue} {row.daysOverdue === 1 ? 'day' : 'days'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground" data-nexen-id="nx-3e6db309-22">Not due</span>
                    )}
                  </td>
                  <td className="hidden px-2.5 py-3 sm:px-4 text-muted-foreground sm:table-cell" data-nexen-id="nx-3e6db309-23">
                    {formatDay(row.lastFollowUpSentAt) ?? 'Never'}
                  </td>
                  <td className="px-2.5 py-3 sm:px-4" data-nexen-id="nx-3e6db309-24">
                    {isEditing ? (
                      <form
                        className="flex flex-col gap-2 sm:flex-row sm:items-center"
                        onSubmit={(e) => handleSave(e, row)}
                       data-nexen-id="nx-3e6db309-25">
                        <input
                          type="date"
                          aria-label={`Expected collection date for ${row.invoiceNumber}`}
                          value={draftDate}
                          onChange={(e) => setDraftDate(e.target.value)}
                          className="h-9 w-full min-w-0 rounded-[var(--radius)] border border-border bg-background px-2 text-sm text-foreground sm:w-auto"
                         data-nexen-id="nx-3e6db309-26"/>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={saving}
                            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                           data-nexen-id="nx-3e6db309-27">
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground"
                           data-nexen-id="nx-3e6db309-28">
                            Cancel
                          </button>
                        </div>
                        {error && (
                          <p role="alert" className="w-full text-xs text-destructive" data-nexen-id="nx-3e6db309-29">
                            {error}
                          </p>
                        )}
                      </form>
                    ) : (
                      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                        {expected ? (
                          <span className="text-muted-foreground" data-nexen-id="nx-3e6db309-30">{expected}</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground" data-nexen-id="nx-3e6db309-31">
                            Unscheduled
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground"
                         data-nexen-id="nx-3e6db309-32">
                          {expected ? 'Change' : 'Set date'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}