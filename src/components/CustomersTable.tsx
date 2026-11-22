
import Link from 'next/link';
import type { Customer } from '@/types/customer';

export type CustomerListItem = Customer & {
  outstandingBalance?: number | string | null;
};

interface CustomersTableProps {
  customers: CustomerListItem[];
  emptyMessage?: string;
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function formatBalance(value: CustomerListItem['outstandingBalance']): string {
  const amount = Number(value ?? 0);
  return inr.format(Number.isFinite(amount) ? amount : 0);
}

export default function CustomersTable({
  customers,
  emptyMessage = 'No customers yet. Tap New customer to add your first one.',
}: CustomersTableProps) {
  const safeCustomers = Array.isArray(customers) ? customers : [];

  if (safeCustomers.length === 0) {
    return (
      <div className="w-full rounded-[var(--radius)] border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 overflow-x-auto rounded-[var(--radius)] border bg-card shadow-sm">
      <ul className="divide-y" data-nexen-id="nx-36768cc5-0">
        {safeCustomers.map((customer) => {
          const contact = customer.phone || customer.email || 'No contact saved';
          const balance = Number(customer.outstandingBalance ?? 0);
          const hasBalance = Number.isFinite(balance) && balance > 0;

          return (
            <li data-nexen-component="nx_components_CustomersTable" key={customer.id} data-nexen-id="nx-36768cc5-1">
              <Link
                href={`/customers/${customer.id}`}
                aria-label={`Open ${customer.name}`}
                className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
               data-nexen-id="nx-36768cc5-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground" data-nexen-id="nx-36768cc5-3">{customer.name}</p>
                  <p className="truncate text-sm text-muted-foreground" data-nexen-id="nx-36768cc5-4">{contact}</p>
                </div>
                <span
                  className={`shrink-0 self-start rounded-full px-3 py-1 text-sm font-semibold sm:self-auto ${
                    hasBalance ? 'bg-accent/15 text-accent' : 'text-muted-foreground'
                  }`}
                 data-nexen-id="nx-36768cc5-5">
                  {formatBalance(customer.outstandingBalance)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}