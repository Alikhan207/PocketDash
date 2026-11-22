'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import ExpenseList from '@/components/ExpenseList';
import PageHeader from '@/components/PageHeader';
import { ApiError, createExpensRevisedPaymentDate, getExpenses } from '@/lib/api';
import type { Expens } from '@/types/expens';

function toDay(value: string | Date): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expens[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [today, setToday] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [revisedDate, setRevisedDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setExpenses(await getExpenses());
      setLoadError(null);
    } catch {
      setLoadError('Could not load bills. Please try again.');
    }
  }, []);

  useEffect(() => {
    setToday(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()));
    void load();
  }, [load]);

  const overdue = (expenses ?? []).filter(
    (e) => e.status === 'unpaid' && !e.revisedPaymentDate && !!today && toDay(e.dueDate) < today,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    if (!selectedId) {
      setFormError('Choose an overdue bill.');
      return;
    }
    if (!revisedDate || revisedDate < today) {
      setFormError('The expected payment date must be today or a later date.');
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      await createExpensRevisedPaymentDate(selectedId, { revised_payment_date: revisedDate });
      setSelectedId('');
      setRevisedDate('');
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save the revised date.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main data-nexen-component="nx_app_expenses_page" className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6" data-nexen-id="nx-8976e64d-0">
      <PageHeader
        title="Bills"
        description="Upcoming and overdue bills by category and due date."
        actions={null}
        className="min-w-0"
      />

      {loadError && <p className="text-sm text-destructive" data-nexen-id="nx-8976e64d-1">{loadError}</p>}

      {overdue.length > 0 && (
        <section className="min-w-0 space-y-3 rounded-[var(--radius)] border bg-card p-4 shadow-sm" data-nexen-id="nx-8976e64d-2">
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-8976e64d-3">
            Overdue unpaid bills are counted as outflows today in the cash forecast until you set a
            revised payment date.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start" data-nexen-id="nx-8976e64d-4">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="h-11 w-full min-w-0 rounded-[var(--radius)] border bg-background px-3 text-sm sm:flex-1"
             data-nexen-id="nx-8976e64d-5">
              <option value="">Select an overdue bill</option>
              {overdue.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.description}
                </option>
              ))}
            </select>
            <input
              type="date"
              min={today}
              value={revisedDate}
              onChange={(e) => setRevisedDate(e.target.value)}
              aria-label="Revised payment date"
              className="h-11 w-full rounded-[var(--radius)] border bg-background px-3 text-sm sm:w-48"
             data-nexen-id="nx-8976e64d-6"/>
            <button
              type="submit"
              disabled={isSaving}
              className="h-11 w-full rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow disabled:opacity-60 sm:w-auto"
             data-nexen-id="nx-8976e64d-7">
              {isSaving ? 'Saving…' : 'Set revised date'}
            </button>
          </form>
          {formError && <p className="text-sm text-destructive" data-nexen-id="nx-8976e64d-8">{formError}</p>}
        </section>
      )}

      <ExpenseList expenses={expenses} />
    </main>
  );
}