
'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createExpensMarkPaid } from '@/lib/api';

interface MarkPaidFormProps {
  expenseId: string;
  onPaid?: () => void;
}

function kolkataToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isCalendarDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export default function MarkPaidForm({ expenseId, onPaid }: MarkPaidFormProps) {
  const [paidOn, setPaidOn] = useState('');
  const [today, setToday] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    setToday(kolkataToday());
  }, []);

  function validate(): string | null {
    if (!paidOn) return 'Select the date the bill was paid.';
    if (!isCalendarDate(paidOn) || (today && paidOn > today)) {
      return 'Enter a valid date that is today or earlier.';
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || isPaid) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    inFlight.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      await createExpensMarkPaid(expenseId, { paid_on: paidOn });
      setIsPaid(true);
      onPaid?.();
    } catch (err) {
      inFlight.current = false;
      setError(err instanceof Error ? err.message : 'Could not mark the bill as paid. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const disabled = isSubmitting || isPaid;

  return (
    <form data-nexen-component="nx_components_MarkPaidForm" onSubmit={handleSubmit} noValidate className="w-full min-w-0 space-y-3" data-nexen-id="nx-a95ddb7b-0">
      <div className="min-w-0">
        <label htmlFor={`paid-on-${expenseId}`} className="mb-1 block text-sm font-medium text-foreground" data-nexen-id="nx-a95ddb7b-1">
          Date paid
        </label>
        <input
          id={`paid-on-${expenseId}`}
          name="paidOn"
          type="date"
          value={paidOn}
          max={today || undefined}
          disabled={disabled}
          onChange={(e) => {
            setPaidOn(e.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `paid-on-error-${expenseId}` : undefined}
          className="h-10 w-full max-w-full min-w-0 rounded-[var(--radius)] border border-border bg-background px-3 text-sm text-foreground disabled:opacity-60"
         data-nexen-id="nx-a95ddb7b-2"/>
      </div>

      {error && (
        <p
          id={`paid-on-error-${expenseId}`}
          role="alert"
          className="text-sm text-[hsl(var(--destructive))]"
         data-nexen-id="nx-a95ddb7b-3">
          {error}
        </p>
      )}

      {isPaid && (
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-a95ddb7b-4">This bill is marked as paid.</p>
      )}

      <button
        type="submit"
        disabled={disabled}
        className="inline-flex h-10 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
       data-nexen-id="nx-a95ddb7b-5">
        {isSubmitting ? 'Saving…' : isPaid ? 'Marked as paid' : 'Mark as paid'}
      </button>
    </form>
  );
}