'use client';
import {useParams} from 'next/navigation';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  ApiError,
  createInvoiceCancel,
  createInvoiceIssue,
  deleteInvoice,
  getAuthMe,
  getInvoiceById,
  getInvoicePayments,
  getShopById,
} from '@/lib/api';
import InvoicePreview from '@/components/InvoicePreview';
import OutstandingBalanceCard from '@/components/OutstandingBalanceCard';
import PaymentHistoryList from '@/components/PaymentHistoryList';
import RecordPaymentForm from '@/components/RecordPaymentForm';
import ReminderPanel from '@/components/ReminderPanel';
import InvoiceEditPanel from '@/components/InvoiceEditPanel';

type InvoiceDetail = Awaited<ReturnType<typeof getInvoiceById>>;
type PaymentList = Awaited<ReturnType<typeof getInvoicePayments>>;
type ShopData = Awaited<ReturnType<typeof getShopById>>;

type PageData = { detail: InvoiceDetail; payments: PaymentList; shop: ShopData };

const btn =
  'inline-flex h-10 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold disabled:opacity-50';

export default function InvoiceDetailPage() {
  const params = useParams<{id:string}>();
  const { id } = params;
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [data, setData] = useState<PageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canView = isAuthenticated && user?.role === 'Seller';

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const me = await getAuthMe();
      const [detail, payments, shop] = await Promise.all([
        getInvoiceById(id),
        getInvoicePayments(id),
        getShopById(me.shop_id),
      ]);
      setData({ detail, payments, shop });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load this invoice.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/login');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (canView) void load();
  }, [canView, load]);

  async function runAction(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The action could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this draft invoice?')) return;
    setBusy(true);
    try {
      await deleteInvoice(id);
      router.push('/invoices');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The draft could not be deleted.');
      setBusy(false);
    }
  }

  if (authLoading) return <p className="p-6 text-sm text-muted-foreground" data-nexen-id="nx-4eca7f76-0">Loading…</p>;
  if (!isAuthenticated) return null;
  if (!canView) {
    return <p className="p-6 text-sm" data-nexen-id="nx-4eca7f76-1">This page is not available for your role.</p>;
  }
  if (isLoading && !data) return <p className="p-6 text-sm" data-nexen-id="nx-4eca7f76-2">Loading invoice…</p>;
  if (!data) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive" data-nexen-id="nx-4eca7f76-3">{error ?? 'Invoice not found.'}</p>
        <Link href="/invoices" className="mt-3 inline-block text-sm underline" data-nexen-id="nx-4eca7f76-4">Back to invoices</Link>
      </div>
    );
  }

  const { detail, payments, shop } = data;
  const { invoice } = detail;
  const status = invoice.status;
  const total = Number(invoice.totalAmount);
  const outstanding = Number(detail.outstanding_balance);
  const paid = total - outstanding;
  const isDraft = status === 'draft';
  const isUnpaid = status === 'unpaid';
  const canEditItems = (isDraft || isUnpaid) && payments.length === 0;
  const canPay = isUnpaid || status === 'partially_paid';

  return (
    <div data-nexen-component="nx_app_invoices__id__page" className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase text-muted-foreground" data-nexen-id="nx-4eca7f76-5">Status: {status.replace('_', ' ')}</p>
          <h1 className="text-2xl font-extrabold tracking-tight" data-nexen-id="nx-4eca7f76-6">Invoice {invoice.invoiceNumber || 'draft'}</h1>
        </div>
        <div className="flex flex-wrap gap-2"><button className={btn} onClick={() => window.print()}>Print / Save PDF</button>
          {isDraft && (
            <button className={btn} disabled={busy} onClick={() => runAction(() => createInvoiceIssue(id, {}))} data-nexen-id="nx-4eca7f76-7">
              Issue invoice
            </button>
          )}
          {(isDraft || isUnpaid) && (
            <button
              className={btn}
              disabled={busy}
              onClick={() => {
                if (window.confirm('Cancel this invoice?')) {
                  void runAction(() => createInvoiceCancel(id, {}));
                }
              }}
             data-nexen-id="nx-4eca7f76-8">
              Cancel invoice
            </button>
          )}
          {isDraft && (
            <button className={btn} disabled={busy} onClick={handleDelete} data-nexen-id="nx-4eca7f76-9">
              Delete draft
            </button>
          )}
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-destructive" data-nexen-id="nx-4eca7f76-10">{error}</p>}

      <p className="text-sm text-muted-foreground print:hidden">To save a PDF, choose “Save as PDF” in the print dialog.</p>
      <OutstandingBalanceCard total={total} paid={paid} title="Balance" />

      <div className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm">
        <InvoicePreview
          invoice={invoice}
          items={detail.items}
          payments={payments}
          shop={shop}
          customer={detail.customer}
        />
      </div>

      {canEditItems && (
        <div className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm">
          <InvoiceEditPanel invoice={invoice} items={detail.items} onSaved={load} />
        </div>
      )}

      {canPay && (
        <div className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm">
          <RecordPaymentForm invoiceId={id} outstandingBalance={outstanding} onRecorded={() => void load()} />
        </div>
      )}

      <div className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm">
        <PaymentHistoryList payments={payments} />
      </div>

      {!isDraft && status !== 'cancelled' && (
        <div className="min-w-0 rounded-[var(--radius)] border bg-card p-4 shadow-sm">
          <ReminderPanel invoiceId={id} customerPhone={detail.customer.phone} />
        </div>
      )}
    </div>
  );
}