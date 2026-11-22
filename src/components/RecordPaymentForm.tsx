'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createInvoicePayment } from '@/lib/api';
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey';

type Method = 'cash' | 'upi' | 'bank_transfer' | 'card' | 'other';
type Kind = 'advance' | 'partial' | 'final';

const METHODS: { value: Method; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

const KINDS: { value: Kind; label: string }[] = [
  { value: 'advance', label: 'Advance' },
  { value: 'partial', label: 'Partial payment' },
  { value: 'final', label: 'Final payment' },
];

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

function kolkataToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

type Props = {
  invoiceId: string;
  outstandingBalance: number;
  onRecorded?: () => void;
};

type Errors = Partial<Record<'amount' | 'paidOn' | 'method' | 'kind', string>>;

const inputClass =
  'w-full min-w-0 rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm text-foreground';

export default function RecordPaymentForm({ invoiceId, outstandingBalance, onRecorded }: Props) {
  const { idempotencyKey, isSubmitting, submit, reset } = useIdempotencyKey();
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState('');
  const [method, setMethod] = useState<Method | ''>('');
  const [kind, setKind] = useState<Kind | ''>('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setPaidOn(kolkataToday());
  }, []);

  function validate(): Errors {
    const next: Errors = {};
    const today = kolkataToday();
    const value = amount.trim();
    const parsed = Number(value);

    if (!value) {
      next.amount = 'Enter the amount received.';
    } else if (!AMOUNT_PATTERN.test(value) || !(parsed > 0) || parsed > outstandingBalance) {
      next.amount = `Enter an amount between ₹0.01 and the outstanding balance of ₹${outstandingBalance.toFixed(2)}.`;
    }

    if (!paidOn) {
      next.paidOn = 'Select the date the payment was received.';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || Number.isNaN(Date.parse(paidOn)) || paidOn > today) {
      next.paidOn = 'Enter a valid date that is today or earlier.';
    }

    if (!method) next.method = 'Choose how the payment was received.';
    if (!kind) next.kind = 'Choose whether this is an advance, partial payment or final payment.';

    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const chosenMethod = method;
    const chosenKind = kind;
    if (!chosenMethod || !chosenKind) return;

    setFormError(null);
    try {
      await submit(async (key: string) => {
        await createInvoicePayment(invoiceId, {
          amount: amount.trim(),
          paidOn,
          method: chosenMethod,
          kind: chosenKind,
          verificationStatus: 'seller_recorded',
          idempotencyKey: key,
        });
      });
      reset();
      setAmount('');
      setMethod('');
      setKind('');
      onRecorded?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not record the payment. Try again.');
    }
  }

  return (
    <form data-nexen-component="nx_components_RecordPaymentForm"
      onSubmit={handleSubmit}
      noValidate
      className="w-full max-w-md space-y-4 rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm"
     data-nexen-id="nx-1e8fd553-0">
      <div className="min-w-0">
        <h3 className="text-lg font-bold text-foreground" data-nexen-id="nx-1e8fd553-1">Record a payment</h3>
        <p className="text-sm text-muted-foreground" data-nexen-id="nx-1e8fd553-2">
          Outstanding balance: ₹{outstandingBalance.toFixed(2)}. Saved as seller-recorded, not bank-verified.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="payment-amount" className="text-sm font-medium text-foreground" data-nexen-id="nx-1e8fd553-3">
          Amount received (₹)
        </label>
        <input
          id="payment-amount"
          name="amount"
          inputMode="decimal"
          className={inputClass}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={Boolean(errors.amount)}
         data-nexen-id="nx-1e8fd553-4"/>
        {errors.amount && <p className="text-sm text-destructive" data-nexen-id="nx-1e8fd553-5">{errors.amount}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="payment-date" className="text-sm font-medium text-foreground" data-nexen-id="nx-1e8fd553-6">
          Date received
        </label>
        <input
          id="payment-date"
          name="paidOn"
          type="date"
          className={inputClass}
          value={paidOn}
          onChange={(e) => setPaidOn(e.target.value)}
          aria-invalid={Boolean(errors.paidOn)}
         data-nexen-id="nx-1e8fd553-7"/>
        {errors.paidOn && <p className="text-sm text-destructive" data-nexen-id="nx-1e8fd553-8">{errors.paidOn}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="payment-method" className="text-sm font-medium text-foreground" data-nexen-id="nx-1e8fd553-9">
          Method
        </label>
        <select
          id="payment-method"
          name="method"
          className={inputClass}
          value={method}
          onChange={(e) => setMethod(e.target.value as Method | '')}
          aria-invalid={Boolean(errors.method)}
         data-nexen-id="nx-1e8fd553-10">
          <option value="">Select a method</option>
          {METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {errors.method && <p className="text-sm text-destructive" data-nexen-id="nx-1e8fd553-11">{errors.method}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="payment-kind" className="text-sm font-medium text-foreground" data-nexen-id="nx-1e8fd553-12">
          Type
        </label>
        <select
          id="payment-kind"
          name="kind"
          className={inputClass}
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind | '')}
          aria-invalid={Boolean(errors.kind)}
         data-nexen-id="nx-1e8fd553-13">
          <option value="">Select a type</option>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        {errors.kind && <p className="text-sm text-destructive" data-nexen-id="nx-1e8fd553-14">{errors.kind}</p>}
      </div>

      {formError && (
        <p role="alert" className="text-sm text-destructive" data-nexen-id="nx-1e8fd553-15">
          {formError}
        </p>
      )}

      <input type="hidden" name="idempotencyKey" value={idempotencyKey ?? ''}  data-nexen-id="nx-1e8fd553-16"/>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow disabled:opacity-60"
       data-nexen-id="nx-1e8fd553-17">
        {isSubmitting ? 'Recording…' : 'Record payment'}
      </button>
    </form>
  );
}