'use client';

import { useEffect, useState } from 'react';

type Money = number | string;

export interface InvoicePreviewItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

export interface InvoicePreviewPayment {
  id: string;
  amount: Money;
  paidOn: string;
  method: string;
}

export interface InvoicePreviewProps {
  invoice: {
    invoiceNumber: string;
    status: string;
    issueDate: string;
    dueDate: string;
    notes?: string | null;
    totalAmount: Money;
  };
  items?: InvoicePreviewItem[] | null;
  payments?: InvoicePreviewPayment[] | null;
  shop: { name: string; phone?: string | null; email?: string | null; address?: string | null };
  customer: { name: string; phone?: string | null; email?: string | null };
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  other: 'Other',
};

const rupee = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

const toNumber = (value: Money | null | undefined): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const kolkataDayKey = (iso: string | Date): string =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export default function InvoicePreview({ invoice, items, payments, shop, customer }: InvoicePreviewProps) {
  const safeItems = Array.isArray(items) ? items : [];
  const safePayments = Array.isArray(payments) ? payments : [];

  const total = toNumber(invoice.totalAmount);
  const paid = safePayments.reduce((sum, p) => sum + toNumber(p.amount), 0);
  const outstanding = Math.max(total - paid, 0);
  const isDraft = invoice.status === 'draft';
  const isCancelled = invoice.status === 'cancelled';

  const [isOverdue, setIsOverdue] = useState(false);
  useEffect(() => {
    const todayKey = kolkataDayKey(new Date());
    const dueKey = kolkataDayKey(invoice.dueDate);
    setIsOverdue(!isDraft && !isCancelled && outstanding > 0 && todayKey > dueKey);
  }, [invoice.dueDate, outstanding, isDraft, isCancelled]);

  let statusLabel = 'Unpaid';
  if (isDraft) statusLabel = 'Draft';
  else if (isCancelled) statusLabel = 'Cancelled';
  else if (outstanding <= 0 && total > 0) statusLabel = 'Paid';
  else if (paid > 0) statusLabel = 'Partially paid';

  return (
    <article id="print-invoice" data-nexen-component="nx_components_InvoicePreview" className="mx-auto w-full max-w-3xl rounded-[var(--radius)] border border-border bg-card p-4 text-foreground shadow-sm sm:p-8 print:max-w-none print:border-0 print:shadow-none" data-nexen-id="nx-57f7c81e-0">
      {(isDraft || isCancelled) && (
        <p className="mb-4 rounded-[var(--radius)] border border-border px-3 py-2 text-sm font-semibold uppercase tracking-wide" data-nexen-id="nx-57f7c81e-1">
          {isDraft ? 'Draft invoice — not yet issued' : 'Cancelled — not a payment request'}
        </p>
      )}

      <header className="flex min-w-0 flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:justify-between" data-nexen-id="nx-57f7c81e-2">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-extrabold tracking-tight" data-nexen-id="nx-57f7c81e-3">{shop.name}</h1>
          {shop.address && <p className="break-words text-sm text-muted-foreground" data-nexen-id="nx-57f7c81e-4">{shop.address}</p>}
          <p className="break-all text-sm text-muted-foreground" data-nexen-id="nx-57f7c81e-5">
            {[shop.phone, shop.email].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="min-w-0 sm:text-right">
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-57f7c81e-6">Invoice</p>
          <p className="break-all font-mono text-lg font-semibold" data-nexen-id="nx-57f7c81e-7">{invoice.invoiceNumber}</p>
          <p className="text-sm" data-nexen-id="nx-57f7c81e-8">Issued {formatDate(invoice.issueDate)}</p>
          <p className="text-sm" data-nexen-id="nx-57f7c81e-9">Due {formatDate(invoice.dueDate)}</p>
        </div>
      </header>

      <section className="grid gap-4 py-4 sm:grid-cols-2" data-nexen-id="nx-57f7c81e-10">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground" data-nexen-id="nx-57f7c81e-11">Bill to</p>
          <p className="break-words font-semibold" data-nexen-id="nx-57f7c81e-12">{customer.name}</p>
          <p className="break-all text-sm text-muted-foreground" data-nexen-id="nx-57f7c81e-13">
            {[customer.phone, customer.email].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2 sm:justify-end">
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground" data-nexen-id="nx-57f7c81e-14">
            {statusLabel}
          </span>
          {isOverdue && (
            <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive" data-nexen-id="nx-57f7c81e-15">
              Overdue
            </span>
          )}
        </div>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-sm" data-nexen-id="nx-57f7c81e-16">
          <thead data-nexen-id="nx-57f7c81e-17">
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground" data-nexen-id="nx-57f7c81e-18">
              <th className="py-2 pr-2 font-semibold" data-nexen-id="nx-57f7c81e-19">Item</th>
              <th className="py-2 pr-2 text-right font-semibold" data-nexen-id="nx-57f7c81e-20">Qty</th>
              <th className="py-2 pr-2 text-right font-semibold" data-nexen-id="nx-57f7c81e-21">Unit price</th>
              <th className="py-2 text-right font-semibold" data-nexen-id="nx-57f7c81e-22">Amount</th>
            </tr>
          </thead>
          <tbody data-nexen-id="nx-57f7c81e-23">
            {safeItems.map((item) => (
              <tr key={item.id} className="border-b border-border" data-nexen-id="nx-57f7c81e-24">
                <td className="break-words py-2 pr-2" data-nexen-id="nx-57f7c81e-25">{item.description}</td>
                <td className="py-2 pr-2 text-right" data-nexen-id="nx-57f7c81e-26">{item.quantity}</td>
                <td className="py-2 pr-2 text-right" data-nexen-id="nx-57f7c81e-27">{rupee.format(toNumber(item.unitPrice))}</td>
                <td className="py-2 text-right" data-nexen-id="nx-57f7c81e-28">
                  {rupee.format(toNumber(item.quantity) * toNumber(item.unitPrice))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm" data-nexen-id="nx-57f7c81e-29">
        <div className="flex justify-between font-semibold">
          <span data-nexen-id="nx-57f7c81e-30">Invoice total</span>
          <span data-nexen-id="nx-57f7c81e-31">{rupee.format(total)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span data-nexen-id="nx-57f7c81e-32">Recorded payments</span>
          <span data-nexen-id="nx-57f7c81e-33">{rupee.format(paid)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
          <span data-nexen-id="nx-57f7c81e-34">Outstanding balance</span>
          <span data-nexen-id="nx-57f7c81e-35">{rupee.format(outstanding)}</span>
        </div>
      </section>

      <section className="mt-6" data-nexen-id="nx-57f7c81e-36">
        <h2 className="text-sm font-semibold" data-nexen-id="nx-57f7c81e-37">Payments received</h2>
        {safePayments.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-57f7c81e-38">No payments recorded.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm" data-nexen-id="nx-57f7c81e-39">
            {safePayments.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-1" data-nexen-id="nx-57f7c81e-40">
                <span className="min-w-0 break-words" data-nexen-id="nx-57f7c81e-41">
                  {formatDate(p.paidOn)} · {METHOD_LABELS[p.method] ?? p.method} · seller-recorded, not bank-verified
                </span>
                <span data-nexen-id="nx-57f7c81e-42">{rupee.format(toNumber(p.amount))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {invoice.notes && (
        <section className="mt-6" data-nexen-id="nx-57f7c81e-43">
          <h2 className="text-sm font-semibold" data-nexen-id="nx-57f7c81e-44">Notes</h2>
          <p className="whitespace-pre-line break-words text-sm text-muted-foreground" data-nexen-id="nx-57f7c81e-45">{invoice.notes}</p>
        </section>
      )}

      <p className="mt-8 text-xs text-muted-foreground" data-nexen-id="nx-57f7c81e-46">
        Delivery charges and the invoice total are amounts owed, not cash received. Estimates only.
      </p>
    </article>
  );
}