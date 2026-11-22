'use client';

import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createExpens, ApiError } from '@/lib/api';

const CATEGORIES = [
  { value: 'blank_t_shirts', label: 'Blank T-shirts' },
  { value: 'printing', label: 'Printing' },
  { value: 'yarn', label: 'Yarn' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'other', label: 'Other' },
] as const;

type Category = (typeof CATEGORIES)[number]['value'];
type FieldName = 'description' | 'category' | 'amount' | 'dueDate';
type FieldErrors = Partial<Record<FieldName, string>>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

const inputClass =
  'w-full min-w-0 rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';
const labelClass = 'mb-1 block text-sm font-medium text-foreground';
const errorClass = 'mt-1 text-sm text-destructive';

export default function ExpenseForm() {
  const router = useRouter();
  const submittingRef = useRef(false);

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    const trimmed = description.trim();

    if (!trimmed) {
      found.description = 'Please describe what this bill is for.';
    } else if (trimmed.length < 2) {
      found.description = 'Enter a short description of the bill.';
    }

    if (!category) {
      found.category = 'Please choose a category for this bill.';
    }

    const numeric = Number(amount);
    if (!amount.trim() || !AMOUNT_PATTERN.test(amount.trim()) || !(numeric > 0)) {
      found.amount = 'Enter an amount greater than ₹0 with no more than two decimal places.';
    }

    if (!dueDate) {
      found.dueDate = "Enter the bill's due date.";
    } else if (!DATE_PATTERN.test(dueDate) || Number.isNaN(Date.parse(dueDate))) {
      found.dueDate = 'Enter the due date as a date, for example 15/07/2025.';
    }

    return found;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;

    setFormError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !category) return;

    submittingRef.current = true;
    setIsSaving(true);
    try {
      await createExpens({
        description: description.trim(),
        category,
        amount: Number(amount),
        dueDate,
      });
      router.push('/expenses');
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : 'Could not save the bill. Your entries are still here.',
      );
    } finally {
      submittingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <form data-nexen-component="nx_components_ExpenseForm"
      noValidate
      onSubmit={handleSubmit}
      className="w-full max-w-xl min-w-0 space-y-5 rounded-[var(--radius)] border border-border bg-card p-6 text-card-foreground shadow-sm"
     data-nexen-id="nx-99490fa5-0">
      <div>
        <label htmlFor="expense-description" className={labelClass} data-nexen-id="nx-99490fa5-1">
          Description
        </label>
        <input
          id="expense-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? 'expense-description-error' : undefined}
          className={inputClass}
         data-nexen-id="nx-99490fa5-2"/>
        {errors.description && (
          <p id="expense-description-error" className={errorClass} data-nexen-id="nx-99490fa5-3">
            {errors.description}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="expense-category" className={labelClass} data-nexen-id="nx-99490fa5-4">
          Category
        </label>
        <select
          id="expense-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category | '')}
          aria-invalid={Boolean(errors.category)}
          aria-describedby={errors.category ? 'expense-category-error' : undefined}
          className={inputClass}
         data-nexen-id="nx-99490fa5-5">
          <option value="">Select a category</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {errors.category && (
          <p id="expense-category-error" className={errorClass} data-nexen-id="nx-99490fa5-6">
            {errors.category}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="expense-amount" className={labelClass} data-nexen-id="nx-99490fa5-7">
          Amount (₹)
        </label>
        <input
          id="expense-amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={Boolean(errors.amount)}
          aria-describedby={errors.amount ? 'expense-amount-error' : undefined}
          className={inputClass}
         data-nexen-id="nx-99490fa5-8"/>
        {errors.amount && (
          <p id="expense-amount-error" className={errorClass} data-nexen-id="nx-99490fa5-9">
            {errors.amount}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="expense-due-date" className={labelClass} data-nexen-id="nx-99490fa5-10">
          Due date
        </label>
        <input
          id="expense-due-date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-invalid={Boolean(errors.dueDate)}
          aria-describedby={errors.dueDate ? 'expense-due-date-error' : undefined}
          className={inputClass}
         data-nexen-id="nx-99490fa5-11"/>
        {errors.dueDate && (
          <p id="expense-due-date-error" className={errorClass} data-nexen-id="nx-99490fa5-12">
            {errors.dueDate}
          </p>
        )}
      </div>

      {formError && (
        <p role="alert" className={errorClass} data-nexen-id="nx-99490fa5-13">
          {formError}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
         data-nexen-id="nx-99490fa5-14">
          {isSaving ? 'Saving…' : 'Save bill'}
        </button>
      </div>
    </form>
  );
}