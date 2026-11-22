import Link from 'next/link';
import type { Invoice } from '@/types/invoice';

export type InvoiceTableRow = Invoice & {
  customerName: string;
  outstandingBalance: number | string;
  daysOverdue: number;
};

type InvoiceTableProps = {
  invoices?: InvoiceTableRow[];
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const datePart = String(value).slice(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return '—';
  return `${String(day).padStart(2, '0')} ${MONTHS[month - 1]} ${year}`;
}

function formatMoney(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusLabel(invoice: InvoiceTableRow): { text: string; tone: 'danger' | 'soft' | 'muted' } {
  const outstanding = Number(invoice.outstandingBalance ?? 0);
  if (invoice.status === 'cancelled') return { text: 'Cancelled', tone: 'muted' };
  if (invoice.status === 'draft') return { text: 'Draft', tone: 'muted' };
  if (outstanding <= 0 || invoice.status === 'paid') return { text: 'Paid', tone: 'soft' };
  if (invoice.daysOverdue > 0) {
    return { text: `Overdue · ${invoice.daysOverdue} ${invoice.daysOverdue === 1 ? 'day' : 'days'}`, tone: 'danger' };
  }
  if (invoice.status === 'partially_paid') return { text: 'Partially paid', tone: 'soft' };
  return { text: 'Unpaid', tone: 'soft' };
}

const TONE_CLASSES: Record<'danger' | 'soft' | 'muted', string> = {
  danger: 'bg-destructive/10 text-destructive',
  soft: 'bg-secondary text-secondary-foreground',
  muted: 'bg-muted text-muted-foreground',
};

export default function InvoiceTable({ invoices }: InvoiceTableProps) {
  const safeInvoices = Array.isArray(invoices) ? invoices : [];

  if (safeInvoices.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
        No invoices here yet. Create an invoice to start tracking what is owed.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-[var(--radius)] border bg-card shadow-sm">
      <table className="w-full border-collapse text-sm sm:min-w-[40rem]" data-nexen-id="nx-6f93262a-0">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground" data-nexen-id="nx-6f93262a-1">
          <tr data-nexen-id="nx-6f93262a-2">
            <th scope="col" className="px-2.5 py-3 sm:px-4 text-left font-semibold" data-nexen-id="nx-6f93262a-3">Invoice</th>
            <th scope="col" className="hidden px-2.5 py-3 sm:px-4 text-left font-semibold sm:table-cell" data-nexen-id="nx-6f93262a-4">Customer</th>
            <th scope="col" className="hidden px-2.5 py-3 sm:px-4 text-left font-semibold sm:table-cell" data-nexen-id="nx-6f93262a-5">Issued</th>
            <th scope="col" className="hidden px-2.5 py-3 sm:px-4 text-left font-semibold sm:table-cell" data-nexen-id="nx-6f93262a-6">Due</th>
            <th scope="col" className="hidden px-2.5 py-3 sm:px-4 text-right font-semibold sm:table-cell" data-nexen-id="nx-6f93262a-7">Total</th>
            <th scope="col" className="px-2.5 py-3 sm:px-4 text-right font-semibold" data-nexen-id="nx-6f93262a-8">Outstanding</th>
            <th scope="col" className="px-2.5 py-3 sm:px-4 text-left font-semibold" data-nexen-id="nx-6f93262a-9">Status</th>
          </tr>
        </thead>
        <tbody data-nexen-id="nx-6f93262a-10">
          {safeInvoices.map((invoice) => {
            const status = statusLabel(invoice);
            return (
              <tr data-nexen-component="nx_components_InvoiceTable" key={invoice.id} className="border-t hover:bg-muted/30" data-nexen-id="nx-6f93262a-11">
                <td className="whitespace-nowrap px-2.5 py-3 sm:px-4 align-middle" data-nexen-id="nx-6f93262a-12">
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="font-mono text-primary underline-offset-4 hover:underline"
                   data-nexen-id="nx-6f93262a-13">
                    {invoice.invoiceNumber}
                  </Link>
                  <span className="block max-w-[10rem] truncate text-xs text-muted-foreground sm:hidden">{invoice.customerName}</span>
                </td>
                <td className="hidden px-2.5 py-3 sm:px-4 align-middle sm:table-cell" data-nexen-id="nx-6f93262a-14">
                  <span className="block min-w-0 truncate" data-nexen-id="nx-6f93262a-15">{invoice.customerName}</span>
                </td>
                <td className="hidden px-2.5 py-3 sm:px-4 align-middle whitespace-nowrap text-muted-foreground sm:table-cell" data-nexen-id="nx-6f93262a-16">
                  {formatDate(invoice.issueDate)}
                </td>
                <td className="hidden px-2.5 py-3 sm:px-4 align-middle whitespace-nowrap text-muted-foreground sm:table-cell" data-nexen-id="nx-6f93262a-17">
                  {formatDate(invoice.dueDate)}
                </td>
                <td className="hidden px-2.5 py-3 sm:px-4 align-middle text-right whitespace-nowrap sm:table-cell" data-nexen-id="nx-6f93262a-18">
                  {formatMoney(invoice.totalAmount)}
                </td>
                <td className="px-2.5 py-3 sm:px-4 align-middle text-right whitespace-nowrap font-semibold" data-nexen-id="nx-6f93262a-19">
                  {formatMoney(invoice.outstandingBalance)}
                </td>
                <td className="px-2.5 py-3 sm:px-4 align-middle" data-nexen-id="nx-6f93262a-20">
                  <span
                    className={`inline-flex w-fit whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[status.tone]}`}
                   data-nexen-id="nx-6f93262a-21">
                    <span className="sm:hidden">{status.text.replace('Overdue · ', '').replace(/ days?$/, 'd late')}</span>
                    <span className="hidden sm:inline">{status.text}</span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}