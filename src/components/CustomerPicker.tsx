'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createCustomer, getCustomers } from '@/lib/api';
import type { Customer } from '@/types/customer';

interface CustomerPickerProps {
  selectedId?: string | null;
  onSelect: (customer: Customer) => void;
}

const PHONE_RE = /^(\+91|0)?[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEARCH_LIMIT_MESSAGE = 'Search is limited to 100 characters. Shorten your search to continue.';

export default function CustomerPicker({ selectedId = null, onSelect }: CustomerPickerProps) {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const safeCustomers = Array.isArray(customers) ? customers : [];

  useEffect(() => {
    if (query.length > 100) {
      setLoadError(SEARCH_LIMIT_MESSAGE);
      return;
    }
    let active = true;
    setLoadError(null);
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const rows = await getCustomers({ q: query.trim() || undefined });
        if (active) setCustomers(Array.isArray(rows) ? rows : []);
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : 'Could not load customers.');
      } finally {
        if (active) setIsLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  function validate(): string | null {
    const trimmedName = name.trim();
    if (!trimmedName) return "Enter the customer's name.";
    if (trimmedName.length > 100) return 'Customer name must be 100 characters or fewer.';
    const phoneValue = phone.trim();
    if (phoneValue && !PHONE_RE.test(phoneValue.replace(/[\s-]/g, ''))) {
      return 'Enter a valid 10-digit Indian mobile number, for example 98765 43210, or leave it blank.';
    }
    const emailValue = email.trim();
    if (emailValue && (emailValue.length > 254 || !EMAIL_RE.test(emailValue))) {
      return 'Enter a valid email address, such as name@example.com, or leave it blank.';
    }
    return null;
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const error = validate();
    setFormError(error);
    if (error) return;

    setIsSaving(true);
    try {
      const created = await createCustomer({
        name: name.trim(),
        phone: phone.trim() ? phone.trim() : undefined,
        email: email.trim() ? email.trim() : undefined,
      });
      setCustomers((prev) => [created, ...prev]);
      onSelect(created);
      setName('');
      setPhone('');
      setEmail('');
      setShowAdd(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the customer. Try again.');
    } finally {
      setIsSaving(false);
    }
  }

  const inputClass =
    'w-full min-w-0 h-10 rounded-[var(--radius)] border border-border bg-background px-3 text-sm text-foreground';

  return (
    <div className="w-full min-w-0 space-y-3 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm">
      <input
        type="search"
        value={query}
        maxLength={100}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search customers by name"
        aria-label="Search customers"
        className={inputClass}
       data-nexen-id="nx-ee5ccbc7-0"/>

      {loadError && <p className="text-sm text-destructive" data-nexen-id="nx-ee5ccbc7-1">{loadError}</p>}
      {isLoading && <p className="text-sm text-muted-foreground" data-nexen-id="nx-ee5ccbc7-2">Searching…</p>}

      <ul className="max-h-64 space-y-1 overflow-y-auto" data-nexen-id="nx-ee5ccbc7-3">
        {safeCustomers.length === 0 && !isLoading && (
          <li className="px-2 py-2 text-sm text-muted-foreground" data-nexen-id="nx-ee5ccbc7-4">No customers match this search.</li>
        )}
        {safeCustomers.map((customer) => {
          const isSelected = customer.id === selectedId;
          return (
            <li data-nexen-component="nx_components_CustomerPicker" key={customer.id} data-nexen-id="nx-ee5ccbc7-5">
              <button
                type="button"
                onClick={() => onSelect(customer)}
                aria-pressed={isSelected}
                className={`flex w-full min-w-0 flex-col items-start rounded-[var(--radius)] px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                  isSelected ? 'bg-primary/10 text-primary' : 'text-foreground'
                }`}
               data-nexen-id="nx-ee5ccbc7-6">
                <span className="w-full truncate font-medium" data-nexen-id="nx-ee5ccbc7-7">{customer.name}</span>
                {(customer.phone || customer.email) && (
                  <span className="w-full truncate text-xs text-muted-foreground" data-nexen-id="nx-ee5ccbc7-8">
                    {[customer.phone, customer.email].filter(Boolean).join(' · ')}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {!showAdd ? (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex h-10 w-full items-center justify-center rounded-full border border-border px-4 text-sm font-semibold text-foreground"
         data-nexen-id="nx-ee5ccbc7-9">
          + Add new customer
        </button>
      ) : (
        <form onSubmit={handleCreate} className="space-y-2 border-t border-border pt-3" data-nexen-id="nx-ee5ccbc7-10">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Customer name *"
            aria-label="Customer name"
            className={inputClass}
           data-nexen-id="nx-ee5ccbc7-11"/>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (optional)"
            aria-label="Phone"
            inputMode="tel"
            className={inputClass}
           data-nexen-id="nx-ee5ccbc7-12"/>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            aria-label="Email"
            inputMode="email"
            className={inputClass}
           data-nexen-id="nx-ee5ccbc7-13"/>
          {formError && <p className="text-sm text-destructive" data-nexen-id="nx-ee5ccbc7-14">{formError}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-10 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow disabled:opacity-60 sm:w-auto"
             data-nexen-id="nx-ee5ccbc7-15">
              {isSaving ? 'Saving…' : 'Save customer'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setFormError(null);
              }}
              className="inline-flex h-10 w-full items-center justify-center rounded-full border border-border px-4 text-sm font-semibold text-foreground sm:w-auto"
             data-nexen-id="nx-ee5ccbc7-16">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}