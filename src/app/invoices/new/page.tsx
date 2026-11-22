'use client';

import { useEffect, useRef, useState, type ComponentProps, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import CustomerPicker from '@/components/CustomerPicker';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/lib/auth';
import {
  ApiError,
  createCustomer,
  createInvoice,
  createSavedItem,
  getSavedItems,
} from '@/lib/api';

type SavedItemRow = Awaited<ReturnType<typeof getSavedItems>>[number];
type CustomerRow = Parameters<ComponentProps<typeof CustomerPicker>['onSelect']>[0];

type Line = {
  id: number;
  description: string;
  quantity: string;
  unitPrice: string;
  savedItemId?: string;
};

type FieldErrors = Record<string, string>;

const PHONE_RE = /^(\+91|0)?[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputCls =
  'h-11 w-full min-w-0 rounded-[var(--radius)] border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';
const primaryBtn =
  'inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow disabled:opacity-60';
const ghostBtn =
  'inline-flex h-9 items-center justify-center rounded-full border px-4 text-sm font-medium text-foreground disabled:opacity-60';

function rupee(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayInKolkata(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function lineValid(l: Line): boolean {
  const q = Number(l.quantity);
  const p = Number(l.unitPrice);
  return (
    l.description.trim().length > 0 &&
    l.quantity.trim() !== '' &&
    Number.isInteger(q) &&
    q > 0 &&
    l.unitPrice.trim() !== '' &&
    Number.isFinite(p) &&
    p >= 0
  );
}

function lineAmount(l: Line): number {
  return Number(l.quantity) * Number(l.unitPrice);
}

export default function NewInvoicePage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newErrors, setNewErrors] = useState<FieldErrors>({});
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ id: 1, description: '', quantity: '1', unitPrice: '' }]);
  const nextId = useRef(2);

  const [savedItems, setSavedItems] = useState<SavedItemRow[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/login');
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    setIssueDate(todayInKolkata());
  }, []);

  useEffect(() => {
    getSavedItems()
      .then((items) => setSavedItems(Array.isArray(items) ? items : []))
      .catch(() => setSavedItems([]));
  }, []);

  const safeSaved = Array.isArray(savedItems) ? savedItems : [];
  const total = lines.filter(lineValid).reduce((sum, l) => sum + lineAmount(l), 0);

  function updateLine(id: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function addLine() {
    const id = nextId.current++;
    setLines((prev) => [...prev, { id, description: '', quantity: '1', unitPrice: '' }]);
  }

  function removeLine(id: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
  }

  function applySaved(lineId: number, savedId: string) {
    const item = safeSaved.find((s) => s.id === savedId);
    if (!item) {
      updateLine(lineId, { savedItemId: undefined });
      return;
    }
    updateLine(lineId, {
      savedItemId: String(item.id),
      description: item.description,
      unitPrice: String(item.unitPrice),
    });
  }

  async function saveAsReusable(line: Line) {
    if (!lineValid(line)) {
      setErrors((e) => ({ ...e, items: 'Fill in the description, quantity and price before saving it for reuse.' }));
      return;
    }
    try {
      const saved = await createSavedItem({
        description: line.description.trim(),
        unitPrice: Number(line.unitPrice),
      });
      setSavedItems((prev) => [...prev, saved]);
    } catch (err) {
      setErrors((e) => ({ ...e, items: err instanceof ApiError ? err.message : 'Could not save this item.' }));
    }
  }

  async function addNewCustomer() {
    const name = newName.trim();
    const phone = newPhone.replace(/[\s-]/g, '');
    const email = newEmail.trim();
    const errs: FieldErrors = {};
    if (name.length < 1) errs.name = "Enter the customer's name (up to 80 characters).";
    else if (name.length > 80) errs.name = "Customer name must be 80 characters or fewer.";
    if (phone && !PHONE_RE.test(phone)) errs.phone = 'Enter a valid 10-digit Indian mobile number, or leave it blank.';
    if (email && !EMAIL_RE.test(email)) errs.email = 'Enter a valid email address, or leave it blank.';
    setNewErrors(errs);
    if (Object.keys(errs).length) return;

    setCreatingCustomer(true);
    try {
      const created = await createCustomer({
        name,
        phone: phone || undefined,
        email: email || undefined,
      });
      setCustomer(created);
      setErrors((e) => ({ ...e, customer: '' }));
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setNewCustomerOpen(false);
    } catch (err) {
      setNewErrors({ name: err instanceof ApiError ? err.message : 'Could not save the customer.' });
    } finally {
      setCreatingCustomer(false);
    }
  }

  function validateInvoice(): FieldErrors {
    const errs: FieldErrors = {};
    if (!customer) errs.customer = 'Please choose a customer for this invoice.';
    const num = invoiceNumber.trim();
    if (num.length > 30) errs.invoiceNumber = 'Invoice number must be 30 characters or fewer.';
    if (!issueDate) errs.issueDate = 'Select an issue date.';
    if (!dueDate) errs.dueDate = 'Select a payment due date.';
    else if (issueDate && dueDate < issueDate) errs.dueDate = 'Due date cannot be before the issue date.';
    if (notes.trim().length > 500) errs.notes = 'Notes must be 500 characters or fewer.';
    if (lines.some((l) => !lineValid(l))) {
      errs.items = 'Check each item: a description, a whole-number quantity above 0 and a price of 0 or more are needed.';
    } else if (total <= 0) {
      errs.items = 'Add at least one item with a description, quantity and price.';
    }
    return errs;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitLock.current) return;
    const errs = validateInvoice();
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length > 0 || !customer) return;

    submitLock.current = true;
    setIsSubmitting(true);
    const body = {
      customer_id: customer.id,
      invoice_number: invoiceNumber.trim(),
      issue_date: issueDate,
      due_date: dueDate,
      notes: notes.trim() || undefined,
      items: lines.filter(lineValid).map((l) => ({
        saved_item_id: l.savedItemId,
        description: l.description.trim(),
        quantity: Number(l.quantity),
        unit_price: Number(l.unitPrice),
      })),
    };
    try {
      const invoice = await createInvoice(body as Parameters<typeof createInvoice>[0]);
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not create the invoice. Try again.');
      submitLock.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <main data-nexen-component="nx_app_invoices_new_page" className="mx-auto w-full max-w-3xl min-w-0 space-y-6 px-4 py-6 sm:px-6" data-nexen-id="nx-06b2cddf-0">
      <PageHeader
        title="New invoice"
        description="Creating an invoice does not increase cash. It starts as a draft and counts as money owed only after you issue it."
        actions={null}
        className=""
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-6" data-nexen-id="nx-06b2cddf-1">
        <section className="min-w-0 space-y-4 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-06b2cddf-2">
          <h2 className="text-base font-semibold" data-nexen-id="nx-06b2cddf-3">Customer</h2>
          {customer && (
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 break-words text-sm" data-nexen-id="nx-06b2cddf-4">
                Selected: <span className="font-semibold" data-nexen-id="nx-06b2cddf-5">{customer.name}</span>
              </p>
              <button type="button" className={ghostBtn} onClick={() => setCustomer(null)} data-nexen-id="nx-06b2cddf-6">
                Clear selection
              </button>
            </div>
          )}
          <CustomerPicker selectedId={customer?.id ?? null} onSelect={(c) => setCustomer(c)} />
          {errors.customer && <p className="text-sm text-destructive" data-nexen-id="nx-06b2cddf-7">{errors.customer}</p>}

          <button
            type="button"
            className={ghostBtn}
            onClick={() => setNewCustomerOpen((o) => !o)}
           data-nexen-id="nx-06b2cddf-8">
            {newCustomerOpen ? 'Hide new customer' : 'Add new customer'}
          </button>

          {newCustomerOpen && (
            <div className="space-y-3 rounded-[var(--radius)] border p-3">
              <label className="block space-y-1 text-sm" data-nexen-id="nx-06b2cddf-9">
                <span className="font-medium" data-nexen-id="nx-06b2cddf-10">Name</span>
                <input className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)}  data-nexen-id="nx-06b2cddf-11"/>
                {newErrors.name && <span className="block text-destructive" data-nexen-id="nx-06b2cddf-12">{newErrors.name}</span>}
              </label>
              <label className="block space-y-1 text-sm" data-nexen-id="nx-06b2cddf-13">
                <span className="font-medium" data-nexen-id="nx-06b2cddf-14">Phone number (optional)</span>
                <input
                  className={inputCls}
                  inputMode="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                 data-nexen-id="nx-06b2cddf-15"/>
                {newErrors.phone && <span className="block text-destructive" data-nexen-id="nx-06b2cddf-16">{newErrors.phone}</span>}
              </label>
              <label className="block space-y-1 text-sm" data-nexen-id="nx-06b2cddf-17">
                <span className="font-medium" data-nexen-id="nx-06b2cddf-18">Email (optional)</span>
                <input
                  className={inputCls}
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                 data-nexen-id="nx-06b2cddf-19"/>
                {newErrors.email && <span className="block text-destructive" data-nexen-id="nx-06b2cddf-20">{newErrors.email}</span>}
              </label>
              <button
                type="button"
                className={primaryBtn}
                disabled={creatingCustomer}
                onClick={addNewCustomer}
               data-nexen-id="nx-06b2cddf-21">
                {creatingCustomer ? 'Saving…' : 'Save and select customer'}
              </button>
            </div>
          )}
        </section>

        <section className="grid min-w-0 gap-4 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:grid-cols-2 sm:p-6" data-nexen-id="nx-06b2cddf-22">
          <label className="space-y-1 text-sm sm:col-span-2" data-nexen-id="nx-06b2cddf-23">
            <span className="font-medium" data-nexen-id="nx-06b2cddf-24">Invoice number (optional)</span>
            <input
              className={inputCls}
              placeholder="Generated automatically if blank"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              maxLength={40}
             data-nexen-id="nx-06b2cddf-25"/>
            {errors.invoiceNumber && <span className="block text-destructive" data-nexen-id="nx-06b2cddf-26">{errors.invoiceNumber}</span>}
          </label>
          <label className="space-y-1 text-sm" data-nexen-id="nx-06b2cddf-27">
            <span className="font-medium" data-nexen-id="nx-06b2cddf-28">Issue date</span>
            <input className={inputCls} type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}  data-nexen-id="nx-06b2cddf-29"/>
            {errors.issueDate && <span className="block text-destructive" data-nexen-id="nx-06b2cddf-30">{errors.issueDate}</span>}
          </label>
          <label className="space-y-1 text-sm" data-nexen-id="nx-06b2cddf-31">
            <span className="font-medium" data-nexen-id="nx-06b2cddf-32">Payment due date</span>
            <input className={inputCls} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}  data-nexen-id="nx-06b2cddf-33"/>
            {errors.dueDate && <span className="block text-destructive" data-nexen-id="nx-06b2cddf-34">{errors.dueDate}</span>}
          </label>
        </section>

        <section className="min-w-0 space-y-4 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-06b2cddf-35">
          <h2 className="text-base font-semibold" data-nexen-id="nx-06b2cddf-36">Items</h2>
          {lines.map((line) => (
            <div key={line.id} className="min-w-0 space-y-3 rounded-[var(--radius)] border p-3">
              {safeSaved.length > 0 && (
                <select
                  className={inputCls}
                  aria-label="Use a saved item"
                  value={line.savedItemId ?? ''}
                  onChange={(e) => applySaved(line.id, e.target.value)}
                 data-nexen-id="nx-06b2cddf-37">
                  <option value="">Use a saved item (optional)</option>
                  {safeSaved.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.description} · {rupee(Number(s.unitPrice))}
                    </option>
                  ))}
                </select>
              )}
              <input
                className={inputCls}
                placeholder="Description, e.g. Printed T-shirt"
                aria-label="Item description"
                value={line.description}
                onChange={(e) => updateLine(line.id, { description: e.target.value, savedItemId: undefined })}
               data-nexen-id="nx-06b2cddf-38"/>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-[6rem_8rem_1fr]">
                <label className="space-y-1 text-xs text-muted-foreground" data-nexen-id="nx-06b2cddf-39">
                  <span data-nexen-id="nx-06b2cddf-40">Qty</span>
                  <input
                    className={inputCls}
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                   data-nexen-id="nx-06b2cddf-41"/>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground" data-nexen-id="nx-06b2cddf-42">
                  <span data-nexen-id="nx-06b2cddf-43">Unit price (₹)</span>
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(line.id, { unitPrice: e.target.value })}
                   data-nexen-id="nx-06b2cddf-44"/>
                </label>
                <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
                  <span data-nexen-id="nx-06b2cddf-45">Line total</span>
                  <p className="h-11 truncate text-sm font-semibold leading-[2.75rem] text-foreground" data-nexen-id="nx-06b2cddf-46">
                    {lineValid(line) ? rupee(lineAmount(line)) : '—'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button type="button" className={ghostBtn} onClick={() => saveAsReusable(line)} data-nexen-id="nx-06b2cddf-47">
                  Save as reusable item
                </button>
                <button type="button" className={ghostBtn} onClick={() => removeLine(line.id)} data-nexen-id="nx-06b2cddf-48">
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button type="button" className={ghostBtn} onClick={addLine} data-nexen-id="nx-06b2cddf-49">
            Add item
          </button>
          {errors.items && <p className="text-sm text-destructive" data-nexen-id="nx-06b2cddf-50">{errors.items}</p>}
          <div className="flex items-center justify-between border-t pt-4 text-sm">
            <span className="text-muted-foreground" data-nexen-id="nx-06b2cddf-51">Invoice total</span>
            <span className="font-semibold" data-nexen-id="nx-06b2cddf-52">{rupee(total)}</span>
          </div>
        </section>

        <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-06b2cddf-53">
          <details data-nexen-id="nx-06b2cddf-54">
            <summary className="cursor-pointer text-sm font-medium" data-nexen-id="nx-06b2cddf-55">Notes (optional)</summary>
            <div className="mt-3 space-y-1">
              <textarea
                className="min-h-24 w-full min-w-0 rounded-[var(--radius)] border bg-background p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
               data-nexen-id="nx-06b2cddf-56"/>
              {errors.notes && <p className="text-sm text-destructive" data-nexen-id="nx-06b2cddf-57">{errors.notes}</p>}
            </div>
          </details>
        </section>

        {formError && (
          <p role="alert" className="text-sm text-destructive" data-nexen-id="nx-06b2cddf-58">
            {formError}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="submit" className={primaryBtn} disabled={isSubmitting} data-nexen-id="nx-06b2cddf-59">
            {isSubmitting ? 'Saving…' : 'Save draft invoice'}
          </button>
        </div>
      </form>
    </main>
  );
}