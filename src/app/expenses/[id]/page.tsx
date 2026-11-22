'use client';
import {useParams} from 'next/navigation';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import MarkPaidForm from '@/components/MarkPaidForm';
import {
  ApiError,
  createExpensRevisedPaymentDate,
  deleteExpens,
  getExpensById,
  updateExpens,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Expens } from '@/types/expens';

const CATEGORIES = [
  { value: 'blank_t_shirts', label: 'Blank T-shirts' },
  { value: 'printing', label: 'Printing' },
  { value: 'yarn', label: 'Yarn' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'other', label: 'Other' },
];

const INPUT =
  'w-full min-w-0 rounded-[var(--radius)] border bg-background px-3 py-2 text-sm text-foreground';
const CARD = 'rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6';
const BUTTON =
  'inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow disabled:opacity-50';

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function toDateInput(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function formatRupees(value: unknown): string {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return `₹${safe.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.message;
  return fallback;
}

function validateEdit(d: {
  description: string;
  category: string;
  amount: string;
  dueDate: string;
}): string | null {
  if (d.description.trim().length < 2) return 'Enter a short description of the bill.';
  if (!d.category) return 'Choose a bill category.';
  const amount = d.amount.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
    return 'Enter an amount greater than ₹0 with no more than two decimal places.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dueDate)) return 'Please enter a valid due date.';
  return null;
}

export default function ExpenseDetailPage() {
  const params = useParams<{id:string}>();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [expense, setExpense] = useState<Expens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [today, setToday] = useState('');
  const [form, setForm] = useState({ description: '', category: '', amount: '', dueDate: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [revised, setRevised] = useState('');
  const [revisedError, setRevisedError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getExpensById(params.id);
      setExpense(data);
      setForm({
        description: data.description,
        category: String(data.category),
        amount: String(data.amount),
        dueDate: toDateInput(data.dueDate),
      });
      setRevised(toDateInput(data.revisedPaymentDate));
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e, 'Could not load this bill.'));
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    setToday(todayIST());
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/login');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) void load();
  }, [isAuthenticated, load]);

  const isPaid = expense?.status === 'paid';
  const effectiveDate = expense
    ? toDateInput(expense.revisedPaymentDate) || toDateInput(expense.dueDate)
    : '';
  const isOverdue = !!expense && !isPaid && !!today && effectiveDate < today;

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const err = validateEdit(form);
    setFormError(err);
    setSavedMsg(null);
    if (err) return;
    setBusy(true);
    try {
      const updated = await updateExpens(params.id, {
        description: form.description.trim(),
        category: form.category as unknown as Expens['category'],
        amount: Number(form.amount),
        dueDate: form.dueDate,
      });
      setExpense(updated);
      setSavedMsg('Bill saved.');
    } catch (ex) {
      setFormError(errorMessage(ex, 'Could not save the bill.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevised(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (!revised) {
      setRevisedError('Enter a revised payment date.');
      return;
    }
    if (!today || revised < today) {
      setRevisedError('The expected payment date must be today or a later date.');
      return;
    }
    setRevisedError(null);
    setBusy(true);
    try {
      await createExpensRevisedPaymentDate(params.id, { revised_payment_date: revised });
      await load();
    } catch (ex) {
      setRevisedError(errorMessage(ex, 'Could not save the revised date.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (busy) return;
    if (!window.confirm('Delete this bill? This cannot be undone.')) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteExpens(params.id);
      router.push('/expenses');
    } catch (ex) {
      setActionError(errorMessage(ex, 'Could not delete this bill.'));
      setBusy(false);
    }
  }

  if (isLoading && !expense) {
    return <p className="px-4 py-6 text-sm text-muted-foreground" data-nexen-id="nx-1418fc44-0">Loading bill…</p>;
  }

  if (loadError || !expense) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className={CARD}>
          <p className="text-sm text-destructive" data-nexen-id="nx-1418fc44-1">{loadError ?? 'Bill not found.'}</p>
          <Link href="/expenses" className="mt-3 inline-block text-sm font-semibold text-primary" data-nexen-id="nx-1418fc44-2">
            Back to bills
          </Link>
        </div>
      </div>
    );
  }

  const categoryLabel =
    CATEGORIES.find((c) => c.value === String(expense.category))?.label ?? String(expense.category);

  return (
    <div data-nexen-component="nx_app_expenses__id__page" className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <PageHeader
        title={expense.description}
        description={`${categoryLabel} · Due ${toDateInput(expense.dueDate)}`}
        actions={
          <Link href="/expenses" className="text-sm font-semibold text-primary" data-nexen-id="nx-1418fc44-3">
            Back to bills
          </Link>
        }
        className=""
      />

      <section className={CARD} data-nexen-id="nx-1418fc44-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-2xl font-extrabold" data-nexen-id="nx-1418fc44-5">{formatRupees(expense.amount)}</p>
          <div className="flex flex-wrap gap-2">
            {isPaid ? (
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground" data-nexen-id="nx-1418fc44-6">
                Paid
              </span>
            ) : isOverdue ? (
              <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive" data-nexen-id="nx-1418fc44-7">
                Overdue
              </span>
            ) : (
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground" data-nexen-id="nx-1418fc44-8">
                Upcoming
              </span>
            )}
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2" data-nexen-id="nx-1418fc44-9">
          <div className="min-w-0">
            <dt className="text-muted-foreground" data-nexen-id="nx-1418fc44-10">Original due date</dt>
            <dd data-nexen-id="nx-1418fc44-11">{toDateInput(expense.dueDate)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground" data-nexen-id="nx-1418fc44-12">Revised payment date</dt>
            <dd data-nexen-id="nx-1418fc44-13">{toDateInput(expense.revisedPaymentDate) || 'Not set'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground" data-nexen-id="nx-1418fc44-14">Paid on</dt>
            <dd data-nexen-id="nx-1418fc44-15">{toDateInput(expense.paidOn) || 'Not paid'}</dd>
          </div>
        </dl>
        {isPaid && (
          <p className="mt-4 text-xs text-muted-foreground" data-nexen-id="nx-1418fc44-16">
            Seller-recorded payment, not bank-verified.
          </p>
        )}
      </section>

      {!isPaid && (
        <section className={CARD} data-nexen-id="nx-1418fc44-17">
          <h2 className="mb-4 text-lg font-bold" data-nexen-id="nx-1418fc44-18">Edit bill</h2>
          <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-2" data-nexen-id="nx-1418fc44-19">
            <label className="min-w-0 space-y-1 text-sm sm:col-span-2" data-nexen-id="nx-1418fc44-20">
              <span data-nexen-id="nx-1418fc44-21">Description</span>
              <input
                className={INPUT}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
               data-nexen-id="nx-1418fc44-22"/>
            </label>
            <label className="min-w-0 space-y-1 text-sm" data-nexen-id="nx-1418fc44-23">
              <span data-nexen-id="nx-1418fc44-24">Category</span>
              <select
                className={INPUT}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
               data-nexen-id="nx-1418fc44-25">
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 space-y-1 text-sm" data-nexen-id="nx-1418fc44-26">
              <span data-nexen-id="nx-1418fc44-27">Amount (₹)</span>
              <input
                className={INPUT}
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
               data-nexen-id="nx-1418fc44-28"/>
            </label>
            <label className="min-w-0 space-y-1 text-sm sm:col-span-2" data-nexen-id="nx-1418fc44-29">
              <span data-nexen-id="nx-1418fc44-30">Due date</span>
              <input
                type="date"
                className={INPUT}
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
               data-nexen-id="nx-1418fc44-31"/>
            </label>
            {formError && <p className="text-sm text-destructive sm:col-span-2" data-nexen-id="nx-1418fc44-32">{formError}</p>}
            {savedMsg && <p className="text-sm text-primary sm:col-span-2" data-nexen-id="nx-1418fc44-33">{savedMsg}</p>}
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy} className={BUTTON} data-nexen-id="nx-1418fc44-34">
                Save changes
              </button>
            </div>
          </form>
        </section>
      )}

      {!isPaid && (
        <section className={CARD} data-nexen-id="nx-1418fc44-35">
          <h2 className="mb-4 text-lg font-bold" data-nexen-id="nx-1418fc44-36">Revised payment date</h2>
          <form onSubmit={handleRevised} className="flex flex-col gap-3 sm:flex-row sm:items-end" data-nexen-id="nx-1418fc44-37">
            <label className="min-w-0 flex-1 space-y-1 text-sm" data-nexen-id="nx-1418fc44-38">
              <span data-nexen-id="nx-1418fc44-39">New expected payment date</span>
              <input
                type="date"
                className={INPUT}
                value={revised}
                onChange={(e) => setRevised(e.target.value)}
               data-nexen-id="nx-1418fc44-40"/>
            </label>
            <button type="submit" disabled={busy} className={BUTTON} data-nexen-id="nx-1418fc44-41">
              Set revised date
            </button>
          </form>
          {revisedError && <p className="mt-2 text-sm text-destructive" data-nexen-id="nx-1418fc44-42">{revisedError}</p>}
        </section>
      )}

      {isPaid ? null : (
        <section className={CARD} data-nexen-id="nx-1418fc44-43">
          <h2 className="mb-4 text-lg font-bold" data-nexen-id="nx-1418fc44-44">Mark as paid</h2>
          <MarkPaidForm expenseId={params.id} onPaid={() => void load()} />
        </section>
      )}

      {!isPaid && (
        <section className={CARD} data-nexen-id="nx-1418fc44-45">
          <h2 className="mb-2 text-lg font-bold" data-nexen-id="nx-1418fc44-46">Delete bill</h2>
          <p className="mb-4 text-sm text-muted-foreground" data-nexen-id="nx-1418fc44-47">
            Remove a bill entered by mistake. Paid bills cannot be deleted.
          </p>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-full border border-destructive px-5 py-2.5 text-sm font-semibold text-destructive disabled:opacity-50"
           data-nexen-id="nx-1418fc44-48">
            Delete bill
          </button>
          {actionError && <p className="mt-2 text-sm text-destructive" data-nexen-id="nx-1418fc44-49">{actionError}</p>}
        </section>
      )}
    </div>
  );
}