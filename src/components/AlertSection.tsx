'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createAlertActionTaken } from '@/lib/api';
import type { Alert } from '@/types/alert';

type AlertSectionProps = {
  alerts?: Alert[] | null;
  onActionTaken?: (alertId: string) => void;
};

const GROUPS = [
  { key: 'follow-ups', title: 'Follow-ups', types: ['overdue_invoice', 'overdue_no_expected_date'] },
  { key: 'bills', title: 'Bills coming up', types: ['upcoming_bill'] },
  { key: 'cash', title: 'Cash alerts', types: ['cash_shortage'] },
];

const ACTION_LABEL: Record<string, string> = {
  overdue_invoice: 'Draft reminder',
  overdue_no_expected_date: 'Set date',
  upcoming_bill: 'Review bill',
  cash_shortage: 'Review forecast',
};

const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const dayFormat = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

function formatDay(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : dayFormat.format(date);
}

function recordHref(alert: Alert): string | null {
  if (alert.alertType === 'cash_shortage' || alert.alertType === 'overdue_no_expected_date') return '/cash-forecast';
  if (alert.invoiceId) return `/invoices/${alert.invoiceId}`;
  if (alert.expenseId) return `/expenses/${alert.expenseId}`;
  return null;
}

export default function AlertSection({ alerts, onActionTaken }: AlertSectionProps) {
  const safeAlerts = Array.isArray(alerts) ? alerts : [];
  const active = safeAlerts.filter((a) => a.status === 'active');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function markReviewed(alert: Alert) {
    setBusyId(alert.id);
    setError(null);
    try {
      if (!onActionTaken) await createAlertActionTaken(alert.id, {});
      setDoneIds((prev) => [...prev, alert.id]);
      onActionTaken?.(alert.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record that action. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  if (active.length === 0) {
    return (
      <p className="rounded-[var(--radius)] border border-border bg-card p-4 text-sm text-muted-foreground" data-nexen-id="nx-2ebd50a8-0">
        No alerts today. You are all caught up.
      </p>
    );
  }

  return (
    <section className="w-full min-w-0 space-y-6" data-nexen-id="nx-2ebd50a8-1">
      {error && (
        <p role="alert" className="text-sm text-destructive" data-nexen-id="nx-2ebd50a8-2">
          {error}
        </p>
      )}

      {GROUPS.map((group) => {
        const items = active.filter((a) => group.types.includes(a.alertType));
        if (items.length === 0) return null;

        return (
          <div key={group.key} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground" data-nexen-id="nx-2ebd50a8-3">
              {group.title} · {items.length}
            </h2>
            <ul className="space-y-3" data-nexen-id="nx-2ebd50a8-4">
              {items.map((alert) => {
                const href = recordHref(alert);
                const done = doneIds.includes(alert.id);
                const busy = busyId === alert.id;

                return (
                  <li data-nexen-component="nx_components_AlertSection"
                    key={alert.id}
                    className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                   data-nexen-id="nx-2ebd50a8-5">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium text-foreground" data-nexen-id="nx-2ebd50a8-6">{alert.message}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {alert.shortageAmount != null && (
                          <span className="font-semibold text-foreground" data-nexen-id="nx-2ebd50a8-7">
                            {rupees.format(Number(alert.shortageAmount))}
                          </span>
                        )}
                        {alert.shortageDate && <span data-nexen-id="nx-2ebd50a8-8">{formatDay(alert.shortageDate)}</span>}
                        {done && (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground" data-nexen-id="nx-2ebd50a8-9">
                            Reviewed
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {href && (
                        <Link
                          href={href}
                          className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-semibold text-foreground"
                         data-nexen-id="nx-2ebd50a8-10">
                          {ACTION_LABEL[alert.alertType] ?? 'Open'}
                        </Link>
                      )}
                      <button
                        type="button"
                        disabled={busy || done}
                        onClick={() => markReviewed(alert)}
                        className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow disabled:opacity-50"
                       data-nexen-id="nx-2ebd50a8-11">
                        {busy ? 'Saving…' : 'Mark reviewed'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}