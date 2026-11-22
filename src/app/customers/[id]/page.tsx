'use client';
import {useParams} from 'next/navigation';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, deleteCustomer, getCustomerById, getCustomerPayments } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Payment } from '@/types/payment';
import CustomerForm from '@/components/CustomerForm';
import InvoiceTable from '@/components/InvoiceTable';
import OutstandingBalanceCard from '@/components/OutstandingBalanceCard';
import PageHeader from '@/components/PageHeader';
import PaymentHistoryList from '@/components/PaymentHistoryList';

type Detail = Awaited<ReturnType<typeof getCustomerById>>;

const isReceivable = (status: string) => status !== 'draft' && status !== 'cancelled';

export default function CustomerDetailPage() {
  const params = useParams<{id:string}>();
  const { id } = params;
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [data, setData] = useState<Detail | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [detail, pays] = await Promise.all([getCustomerById(id), getCustomerPayments(id)]);
      setData(detail);
      setPayments(pays);
      setToday(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace('/login');
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not load this customer.');
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    load();
  }, [loading, isAuthenticated, load, router]);

  const paidByInvoice = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of payments ?? []) {
      map[p.invoiceId] = (map[p.invoiceId] ?? 0) + Number(p.amount);
    }
    return map;
  }, [payments]);

  const receivableTotal = useMemo(
    () =>
      (data?.invoices ?? [])
        .filter((inv) => isReceivable(inv.status))
        .reduce((sum, inv) => sum + Number(inv.totalAmount), 0),
    [data],
  );

  const invoiceRows = useMemo(() => {
    if (!data) return [];
    return data.invoices.map((inv) => {
      const total = Number(inv.totalAmount);
      const receivable = isReceivable(inv.status);
      const outstanding = receivable ? Math.max(total - (paidByInvoice[inv.id] ?? 0), 0) : 0;
      const due = String(inv.dueDate).slice(0, 10);
      const daysOverdue =
        today && receivable && outstanding > 0 && today > due
          ? Math.round(
              (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86400000,
            )
          : 0;
      return {
        ...inv,
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: data.customer.name,
        issueDate: String(inv.issueDate).slice(0, 10),
        dueDate: due,
        totalAmount: inv.totalAmount,
        outstandingBalance: outstanding,
        status: inv.status,
        daysOverdue,
        isOverdue: daysOverdue > 0,
      };
    });
  }, [data, paidByInvoice, today]);

  async function handleDelete() {
    if (!window.confirm('Delete this customer? This cannot be undone.')) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCustomer(id);
      router.push('/customers');
    } catch (e) {
      setDeleteError(
        e instanceof ApiError && e.status === 409
          ? e.message || 'This customer has invoices, so they cannot be deleted.'
          : 'Could not delete this customer.',
      );
      setDeleting(false);
    }
  }

  if (isLoading || loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading customer…</div>;
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Link href="/customers" className="text-sm text-muted-foreground underline" data-nexen-id="nx-e9bf6ff0-0">
          Back to customers
        </Link>
        <div className="rounded-[var(--radius)] border bg-card p-6 text-sm text-destructive shadow-sm">
          {error ?? 'This customer could not be found.'}
        </div>
      </div>
    );
  }

  const { customer } = data;
  const contact = [customer.phone, customer.email].filter(Boolean).join(' · ') || 'No contact details';

  return (
    <div data-nexen-component="nx_app_customers__id__page" className="mx-auto max-w-4xl min-w-0 space-y-6 p-4 sm:p-6">
      <Link href="/customers" className="text-sm text-muted-foreground underline" data-nexen-id="nx-e9bf6ff0-1">
        Back to customers
      </Link>

      <PageHeader
        title={customer.name}
        description={contact}
        className="min-w-0"
        actions={
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="h-11 rounded-full border px-5 text-sm font-semibold text-destructive disabled:opacity-50"
           data-nexen-id="nx-e9bf6ff0-2">
            {deleting ? 'Deleting…' : 'Delete customer'}
          </button>
        }
      />

      {deleteError && (
        <div className="rounded-[var(--radius)] border bg-card p-4 text-sm text-destructive shadow-sm">
          {deleteError}
        </div>
      )}

      <OutstandingBalanceCard
        title="Outstanding balance"
        total={receivableTotal}
        paid={receivableTotal - data.outstanding_balance}
      />

      <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-e9bf6ff0-3">
        <h2 className="mb-4 text-lg font-semibold" data-nexen-id="nx-e9bf6ff0-4">Customer details</h2>
        <CustomerForm
          customerId={customer.id}
          initialValues={{
            name: customer.name,
            phone: customer.phone ?? '',
            email: customer.email ?? '',
          }}
        />
      </section>

      <section className="min-w-0 rounded-[var(--radius)] border bg-card shadow-sm" data-nexen-id="nx-e9bf6ff0-5">
        <h2 className="px-4 pt-4 text-lg font-semibold sm:px-6 sm:pt-6" data-nexen-id="nx-e9bf6ff0-6">Invoices</h2>
        {invoiceRows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground sm:p-6" data-nexen-id="nx-e9bf6ff0-7">No invoices for this customer yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <InvoiceTable invoices={invoiceRows} />
          </div>
        )}
      </section>

      <section className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm sm:p-6" data-nexen-id="nx-e9bf6ff0-8">
        <h2 className="mb-4 text-lg font-semibold" data-nexen-id="nx-e9bf6ff0-9">Payment history</h2>
        <PaymentHistoryList payments={payments} />
      </section>
    </div>
  );
}