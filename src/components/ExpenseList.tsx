'use client';

import { useEffect, useState } from 'react';
import type { Expens } from '@/types/expens';

type ExpenseListProps = {
  expenses?: Expens[] | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  blank_t_shirts: 'Blank T-shirts',
  printing: 'Printing',
  yarn: 'Yarn',
  packaging: 'Packaging',
  delivery: 'Delivery',
  other: 'Other',
};

function kolkataToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function dateKey(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : '';
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

function formatAmount(value: number | string): string {
  const n = Number(value);
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ExpenseList({ expenses }: ExpenseListProps) {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setToday(kolkataToday());
  }, []);

  const rows = Array.isArray(expenses) ? expenses : [];
  const unpaid = rows.filter((e) => String(e.status) !== 'paid' && !e.paidOn);

  const isOverdue = (e: Expens): boolean =>
    today !== null && !e.revisedPaymentDate && dateKey(e.dueDate) < today;

  const overdueCount = unpaid.filter(isOverdue).length;

  const groups = Object.keys(CATEGORY_LABELS)
    .map((category) => ({
      category,
      items: unpaid
        .filter((e) => String(e.category) === category)
        .sort((a, b) => dateKey(a.dueDate).localeCompare(dateKey(b.dueDate))),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <section className="w-full min-w-0 space-y-6" data-nexen-id="nx-026edb62-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-026edb62-1">
          Unpaid bills grouped by category. Overdue bills count as outflows today until a revised date is set.
        </p>
        <span
          className={
            overdueCount > 0
              ? 'inline-flex w-fit rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive'
              : 'inline-flex w-fit rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground'
          }
         data-nexen-id="nx-026edb62-2">
          {overdueCount} overdue
        </span>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-[var(--radius)] border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          No unpaid bills. Add an upcoming bill to see it here.
        </div>
      ) : (
        groups.map((group) => (
          <div
            key={group.category}
            className="rounded-[var(--radius)] border bg-card shadow-sm"
          >
            <div className="border-b px-4 py-3 text-sm font-semibold">
              {CATEGORY_LABELS[group.category]}
              <span className="ml-2 text-xs font-normal text-muted-foreground" data-nexen-id="nx-026edb62-3">
                {group.items.length}
              </span>
            </div>
            <ul className="divide-y" data-nexen-id="nx-026edb62-4">
              {group.items.map((e) => {
                const overdue = isOverdue(e);
                const revised = Boolean(e.revisedPaymentDate);
                return (
                  <li data-nexen-component="nx_components_ExpenseList"
                    key={e.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                   data-nexen-id="nx-026edb62-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" data-nexen-id="nx-026edb62-6">{e.description}</p>
                      <p className="text-xs text-muted-foreground" data-nexen-id="nx-026edb62-7">
                        Due {formatDate(e.dueDate)}
                        {revised && ` · Expected ${formatDate(e.revisedPaymentDate)}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {overdue && (
                        <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive" data-nexen-id="nx-026edb62-8">
                          Overdue
                        </span>
                      )}
                      {revised && (
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground" data-nexen-id="nx-026edb62-9">
                          Revised date
                        </span>
                      )}
                      {!overdue && !revised && (
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground" data-nexen-id="nx-026edb62-10">
                          Upcoming
                        </span>
                      )}
                      <span className="text-sm font-semibold" data-nexen-id="nx-026edb62-11">{formatAmount(e.amount)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}