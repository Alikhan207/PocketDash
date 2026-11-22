import type { Payment } from '@/types/payment';

type PaymentHistoryListProps = {
  payments?: Payment[] | null;
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  other: 'Other',
};

const KIND_LABELS: Record<string, string> = {
  advance: 'Advance',
  partial: 'Partial',
  final: 'Final',
};

// Explicit locale and time zone keep server and client output identical.
const amountFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

function formatAmount(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? amountFormatter.format(n) : '—';
}

function formatDate(value: unknown): string {
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? '—' : dateFormatter.format(d);
}

export default function PaymentHistoryList({ payments }: PaymentHistoryListProps) {
  const rows = Array.isArray(payments) ? payments : [];

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-nexen-id="nx-d8a6376e-0">No payments recorded yet.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-nexen-id="nx-d8a6376e-1">
      {rows.map((payment) => {
        const methodKey = String(payment.method);
        const kindKey = String(payment.kind);
        return (
          <li data-nexen-component="nx_components_PaymentHistoryList"
            key={payment.id}
            className="flex min-w-0 flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
           data-nexen-id="nx-d8a6376e-2">
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-foreground" data-nexen-id="nx-d8a6376e-3">
                {formatAmount(payment.amount)}
              </p>
              <p className="text-sm text-muted-foreground" data-nexen-id="nx-d8a6376e-4">
                {formatDate(payment.paidOn)} · {METHOD_LABELS[methodKey] ?? methodKey}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground" data-nexen-id="nx-d8a6376e-5">
                {KIND_LABELS[kindKey] ?? kindKey}
              </span>
              <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground" data-nexen-id="nx-d8a6376e-6">
                Seller-recorded, not bank-verified
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}