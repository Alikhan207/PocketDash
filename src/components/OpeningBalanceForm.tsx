'use client';

import { useRef, useState, type FormEvent } from 'react';
import { updateShop } from '@/lib/api';

type OpeningBalanceFormProps = {
  shopId: string;
  openingCashBalance?: number | string | null;
  openingBalanceEffectiveDate?: string | Date | null;
  onSaved?: () => void;
};

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function validate(amount: string, date: string): string | null {
  const trimmed = amount.trim();
  if (!trimmed) return 'Enter your opening cash amount.';
  if (trimmed.startsWith('-')) return 'Opening cash must be zero or more rupees.';
  if (!AMOUNT_PATTERN.test(trimmed)) {
    return 'Enter the amount in rupees with up to two decimal places, for example 8000 or 8000.50.';
  }
  if (!date) return 'Choose the date your opening cash amount applies from.';
  return null;
}

export default function OpeningBalanceForm({
  shopId,
  openingCashBalance,
  openingBalanceEffectiveDate,
  onSaved,
}: OpeningBalanceFormProps) {
  const [amount, setAmount] = useState<string>(
    openingCashBalance === null || openingCashBalance === undefined ? '' : String(openingCashBalance)
  );
  const [effectiveDate, setEffectiveDate] = useState<string>(toDateInput(openingBalanceEffectiveDate));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const submitLock = useRef<boolean>(false);

  const currentAmount =
    openingCashBalance === null || openingCashBalance === undefined ? null : String(openingCashBalance);
  const currentDate = toDateInput(openingBalanceEffectiveDate);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;

    const validationError = validate(amount, effectiveDate);
    if (validationError) {
      setSaved(false);
      setError(validationError);
      return;
    }

    submitLock.current = true;
    setIsSaving(true);
    setError(null);
    setSaved(false);

    try {
      await updateShop(shopId, {
        openingCashBalance: Number(amount.trim()),
        openingBalanceEffectiveDate: effectiveDate,
      });
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the opening balance. Try again.');
    } finally {
      submitLock.current = false;
      setIsSaving(false);
    }
  }

  return (
    <div data-nexen-component="nx_components_OpeningBalanceForm" className="w-full max-w-xl space-y-6">
      <div className="rounded-[var(--radius)] border bg-card p-5 shadow-sm">
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-eeaf57d3-0">Current opening cash balance</p>
        <p className="mt-1 break-words text-3xl font-extrabold tracking-tight" data-nexen-id="nx-eeaf57d3-1">
          {currentAmount === null ? 'Not set' : `₹${currentAmount}`}
        </p>
        <p className="mt-2 text-sm text-muted-foreground" data-nexen-id="nx-eeaf57d3-2">
          {currentDate ? `Applies from ${currentDate}` : 'No effective date yet'}
        </p>
        <p className="mt-2 text-xs text-muted-foreground" data-nexen-id="nx-eeaf57d3-3">
          Enter cash at the START of this date. Earlier transactions are already included; transactions on this date are added separately.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-[var(--radius)] border bg-card p-5 shadow-sm" data-nexen-id="nx-eeaf57d3-4">
        <div className="space-y-2">
          <label htmlFor="opening-cash-amount" className="block text-sm font-semibold" data-nexen-id="nx-eeaf57d3-5">
            Opening cash (₹)
          </label>
          <input
            id="opening-cash-amount"
            name="openingCashAmount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="8000 or 8000.50"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-10 w-full min-w-0 rounded-[var(--radius)] border bg-background px-3 text-sm text-foreground"
           data-nexen-id="nx-eeaf57d3-6"/>
        </div>

        <div className="space-y-2">
          <label htmlFor="opening-balance-date" className="block text-sm font-semibold" data-nexen-id="nx-eeaf57d3-7">
            Applies from
          </label>
          <input
            id="opening-balance-date"
            name="openingBalanceEffectiveDate"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="h-10 w-full min-w-0 rounded-[var(--radius)] border bg-background px-3 text-sm text-foreground"
           data-nexen-id="nx-eeaf57d3-8"/>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive break-words" data-nexen-id="nx-eeaf57d3-9">
            {error}
          </p>
        )}
        {saved && !error && (
          <p role="status" className="text-sm text-[hsl(var(--primary))]" data-nexen-id="nx-eeaf57d3-10">
            Opening balance saved.
          </p>
        )}

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow disabled:opacity-60 sm:w-auto"
         data-nexen-id="nx-eeaf57d3-11">
          {isSaving ? 'Saving…' : 'Save opening balance'}
        </button>
      </form>
    </div>
  );
}