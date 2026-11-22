'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError, createCustomer, updateCustomer } from '@/lib/api';
import type { Customer } from '@/types/customer';

type FormValues = { name: string; phone: string; email: string };
type FormErrors = Partial<Record<keyof FormValues, string>>;

interface CustomerFormProps {
  customerId?: string;
  initialValues?: Partial<FormValues>;
}

const PHONE_PATTERN = /^(\+91|0)?[6-9]\d{9}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass = (hasError: boolean) =>
  `w-full min-w-0 rounded-[var(--radius)] border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${
    hasError ? 'border-destructive' : 'border-border'
  }`;

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = "Enter the customer's name.";
  } else if (name.length > 100) {
    errors.name = 'Customer name must be 100 characters or fewer.';
  }

  const phone = values.phone.trim().replace(/[\s-]/g, '');
  if (phone && !PHONE_PATTERN.test(phone)) {
    errors.phone =
      'Enter a valid 10-digit Indian mobile number, for example 98765 43210, or leave it blank.';
  }

  const email = values.email.trim();
  if (email && (email.length > 254 || !EMAIL_PATTERN.test(email) || /\s/.test(email))) {
    errors.email = 'Enter a valid email address, such as name@example.com, or leave it blank.';
  }

  return errors;
}

export default function CustomerForm({ customerId, initialValues }: CustomerFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>({
    name: initialValues?.name ?? '',
    phone: initialValues?.phone ?? '',
    email: initialValues?.email ?? '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function updateField(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const found = validate(values);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    const payload = {
      name: values.name.trim(),
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
    };

    setIsSaving(true);
    try {
      const customer: Customer = customerId
        ? await updateCustomer(customerId, payload)
        : await createCustomer(payload);
      router.push(`/customers/${customer.id}`);
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'Could not save the customer. Please try again.',
      );
      setIsSaving(false);
    }
  }

  return (
    <form data-nexen-component="nx_components_CustomerForm"
      onSubmit={handleSubmit}
      noValidate
      className="w-full max-w-xl rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm"
     data-nexen-id="nx-d98c3011-0">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="customer-name" className="text-sm font-medium text-foreground" data-nexen-id="nx-d98c3011-1">
            Name <span className="text-destructive" data-nexen-id="nx-d98c3011-2">*</span>
          </label>
          <input
            id="customer-name"
            name="name"
            type="text"
            autoComplete="name"
            value={values.name}
            onChange={(e) => updateField('name', e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'customer-name-error' : undefined}
            className={inputClass(Boolean(errors.name))}
           data-nexen-id="nx-d98c3011-3"/>
          {errors.name && (
            <p id="customer-name-error" className="text-sm text-destructive" data-nexen-id="nx-d98c3011-4">
              {errors.name}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="customer-phone" className="text-sm font-medium text-foreground" data-nexen-id="nx-d98c3011-5">
            Phone number <span className="text-muted-foreground" data-nexen-id="nx-d98c3011-6">(optional)</span>
          </label>
          <input
            id="customer-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="98765 43210"
            value={values.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'customer-phone-error' : undefined}
            className={inputClass(Boolean(errors.phone))}
           data-nexen-id="nx-d98c3011-7"/>
          {errors.phone && (
            <p id="customer-phone-error" className="text-sm text-destructive" data-nexen-id="nx-d98c3011-8">
              {errors.phone}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="customer-email" className="text-sm font-medium text-foreground" data-nexen-id="nx-d98c3011-9">
            Email <span className="text-muted-foreground" data-nexen-id="nx-d98c3011-10">(optional)</span>
          </label>
          <input
            id="customer-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={values.email}
            onChange={(e) => updateField('email', e.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'customer-email-error' : undefined}
            className={inputClass(Boolean(errors.email))}
           data-nexen-id="nx-d98c3011-11"/>
          {errors.email && (
            <p id="customer-email-error" className="text-sm text-destructive" data-nexen-id="nx-d98c3011-12">
              {errors.email}
            </p>
          )}
        </div>

        {formError && (
          <p role="alert" className="rounded-[var(--radius)] bg-destructive/10 px-3 py-2 text-sm text-destructive" data-nexen-id="nx-d98c3011-13">
            {formError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
          <Link
            href="/customers"
            className="inline-flex h-10 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-foreground"
           data-nexen-id="nx-d98c3011-14">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSaving}
            aria-busy={isSaving}
            className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
           data-nexen-id="nx-d98c3011-15">
            {isSaving ? 'Saving…' : 'Save customer'}
          </button>
        </div>
      </div>
    </form>
  );
}