import type { Alert } from '@/types/alert';
import type { Customer } from '@/types/customer';
import type { Expens } from '@/types/expens';
import type { FollowUp } from '@/types/followup';
import type { Invoice } from '@/types/invoice';
import type { InvoiceItem } from '@/types/invoiceitem';
import type { Payment } from '@/types/payment';
import type { SavedItem } from '@/types/saveditem';
import type { Scenario } from '@/types/scenario';
import type { Shop } from '@/types/shop';
import type { User } from '@/types/user';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function withQuery(
  url: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  if (!query) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

// ONE envelope convention, applied here so nothing downstream has to think
// about it: route handlers return the entity WRAPPED — `{ task }`, `{ projects }`
// — matching the `{ error }` shape errors already use and leaving room for
// `{ data, meta }` later. This unwraps it, so hooks and pages only ever see
// entities.
//
// Without a single decision, some generated consumers unwrapped and some did
// not: `useTask` stored `{ task: {...} }` as the task itself while the page
// next to it got it right. Both were plausible readings of an unstated rule.
function unwrap(payload: any): any {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }
  const keys = Object.keys(payload);
  // A single-key object whose key is not a known envelope field IS the
  // envelope. Anything else is already the entity — unwrapping a real
  // one-field entity would be worse than leaving a wrapper on.
  if (keys.length === 1 && !['error', 'message', 'ok'].includes(keys[0])) {
    return payload[keys[0]];
  }
  return payload;
}

async function http(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, { ...init, credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (res.status === 204) return undefined;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.error || 'Request failed. Please retry.');
  return unwrap(body);
}

export async function createAuthRegister(input: Record<string, unknown>): Promise<{ user: User; shop: Shop }> {
  return http(`/api/auth/register`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAuthLogin(input: Record<string, unknown>): Promise<{ user: User; shop_id: string; is_demo: boolean }> {
  return http(`/api/auth/login`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAuthLogout(input: Record<string, unknown>): Promise<boolean> {
  return http(`/api/auth/logout`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getAuthMe(query?: Record<string, string | number | boolean | undefined>): Promise<{ user: User; shop_id: string; is_demo: boolean }> {
  return http(withQuery(`/api/auth/me`, query));
}
export async function updateAuthMe(input: Partial<User>): Promise<User> {
  return http(`/api/auth/me`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function createAuthChangePassword(input: { current_password: string; new_password: string }): Promise<boolean> {
  return http(`/api/auth/change-password`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAuthForgotPassword(input: { email: string }): Promise<{ message: string }> {
  return http(`/api/auth/forgot-password`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAuthResetPassword(input: { token: string; password: string }): Promise<boolean> {
  return http(`/api/auth/reset-password`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createWebhookClerk(input: { type: string }): Promise<boolean> {
  return http(`/api/webhooks/clerk`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getShopById(shopId: string, query?: Record<string, string | number | boolean | undefined>): Promise<Shop> {
  return http(withQuery(`/api/shops/${shopId}`, query));
}
export async function updateShop(shopId: string, input: Partial<Omit<Shop, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Shop> {
  return http(`/api/shops/${shopId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function getCustomers(query?: { q?: string }): Promise<(Customer & { outstanding_balance: number })[]> {
  return http(withQuery(`/api/customers`, query));
}
export async function createCustomer(input: Partial<Omit<Customer, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Customer> {
  return http(`/api/customers`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getCustomerById(customerId: string, query?: Record<string, string | number | boolean | undefined>): Promise<{ customer: Customer; outstanding_balance: number; invoices: Invoice[]; payments: Payment[] }> {
  return http(withQuery(`/api/customers/${customerId}`, query));
}
export async function updateCustomer(customerId: string, input: Partial<Omit<Customer, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Customer> {
  return http(`/api/customers/${customerId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteCustomer(customerId: string): Promise<void> {
  return http(`/api/customers/${customerId}`, { method: 'DELETE' });
}
export async function getSavedItems(query?: Record<string, string | number | boolean | undefined>): Promise<SavedItem[]> {
  return http(withQuery(`/api/saved-items`, query));
}
export async function createSavedItem(input: Partial<Omit<SavedItem, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<SavedItem> {
  return http(`/api/saved-items`, { method: 'POST', body: JSON.stringify(input) });
}
export async function updateSavedItem(savedItemId: string, input: Partial<Omit<SavedItem, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<SavedItem> {
  return http(`/api/saved-items/${savedItemId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteSavedItem(savedItemId: string): Promise<void> {
  return http(`/api/saved-items/${savedItemId}`, { method: 'DELETE' });
}
export async function getInvoices(query?: { q?: string; sort?: string; filter?: string }): Promise<(Invoice & { customer_name: string; outstanding_balance: number; days_overdue: number; is_overdue: boolean })[]> {
  return http(withQuery(`/api/invoices`, query));
}
export async function createInvoice(input: Partial<Omit<Invoice, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Invoice> {
  return http(`/api/invoices`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getInvoiceById(invoiceId: string, query?: Record<string, string | number | boolean | undefined>): Promise<{ invoice: Invoice; customer: Customer; items: InvoiceItem[]; outstanding_balance: number; days_overdue: number; is_overdue: boolean }> {
  return http(withQuery(`/api/invoices/${invoiceId}`, query));
}
export async function updateInvoice(invoiceId: string, input: Partial<Omit<Invoice, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Invoice> {
  return http(`/api/invoices/${invoiceId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteInvoice(invoiceId: string): Promise<void> {
  return http(`/api/invoices/${invoiceId}`, { method: 'DELETE' });
}
export async function createInvoiceIssue(invoiceId: string, input: Record<string, unknown>): Promise<Invoice> {
  return http(`/api/invoices/${invoiceId}/issue`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createInvoiceCancel(invoiceId: string, input: Record<string, unknown>): Promise<Invoice> {
  return http(`/api/invoices/${invoiceId}/cancel`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getInvoiceItems(invoiceId: string, query?: Record<string, string | number | boolean | undefined>): Promise<InvoiceItem[]> {
  return http(withQuery(`/api/invoices/${invoiceId}/items`, query));
}
export async function createInvoiceItem(invoiceId: string, input: { description: string; quantity: number; unit_price: number }): Promise<InvoiceItem> {
  return http(`/api/invoices/${invoiceId}/items`, { method: 'POST', body: JSON.stringify(input) });
}
export async function updateInvoiceItem(invoiceId: string, itemId: string, input: Partial<InvoiceItem>): Promise<InvoiceItem> {
  return http(`/api/invoices/${invoiceId}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteInvoiceItem(invoiceId: string, itemId: string): Promise<any> {
  return http(`/api/invoices/${invoiceId}/items/${itemId}`, { method: 'DELETE' });
}
export async function getInvoicePayments(invoiceId: string, query?: Record<string, string | number | boolean | undefined>): Promise<Payment[]> {
  return http(withQuery(`/api/invoices/${invoiceId}/payments`, query));
}
export async function createInvoicePayment(invoiceId: string, input: Partial<Omit<Payment, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<{ payment: Payment; outstanding_balance: number; status: string }> {
  return http(`/api/invoices/${invoiceId}/payments`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getCustomerPayments(customerId: string, query?: Record<string, string | number | boolean | undefined>): Promise<Payment[]> {
  return http(withQuery(`/api/customers/${customerId}/payments`, query));
}
export async function getInvoiceFollowUps(invoiceId: string, query?: Record<string, string | number | boolean | undefined>): Promise<FollowUp[]> {
  return http(withQuery(`/api/invoices/${invoiceId}/follow-ups`, query));
}
export async function createInvoiceFollowUp(invoiceId: string, input: Partial<Omit<FollowUp, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<FollowUp> {
  return http(`/api/invoices/${invoiceId}/follow-ups`, { method: 'POST', body: JSON.stringify(input) });
}
export async function updateFollowUp(followUpId: string, input: Partial<Omit<FollowUp, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<FollowUp> {
  return http(`/api/follow-ups/${followUpId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteFollowUp(followUpId: string): Promise<void> {
  return http(`/api/follow-ups/${followUpId}`, { method: 'DELETE' });
}
export async function createFollowUpMarkSent(followUpId: string, input: { channel: string; sent_at?: string }): Promise<FollowUp> {
  return http(`/api/follow-ups/${followUpId}/mark-sent`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getExpenses(query?: Record<string, string | number | boolean | undefined>): Promise<Expens[]> {
  return http(withQuery(`/api/expenses`, query));
}
export async function createExpens(input: Partial<Omit<Expens, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Expens> {
  return http(`/api/expenses`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getExpensById(expenseId: string, query?: Record<string, string | number | boolean | undefined>): Promise<Expens> {
  return http(withQuery(`/api/expenses/${expenseId}`, query));
}
export async function updateExpens(expenseId: string, input: Partial<Omit<Expens, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Expens> {
  return http(`/api/expenses/${expenseId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteExpens(expenseId: string): Promise<void> {
  return http(`/api/expenses/${expenseId}`, { method: 'DELETE' });
}
export async function createExpensMarkPaid(expenseId: string, input: { paid_on: string }): Promise<any> {
  return http(`/api/expenses/${expenseId}/mark-paid`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createExpensRevisedPaymentDate(expenseId: string, input: { revised_payment_date: string }): Promise<any> {
  return http(`/api/expenses/${expenseId}/revised-payment-date`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getCollections(query?: Record<string, string | number | boolean | undefined>): Promise<Array<{ invoice_id: string; customer_name: string; invoice_number: string; outstanding_amount: number; due_date: string; expected_collection_date: string; days_overdue: number; is_overdue: boolean; last_follow_up_sent_at: string }>> {
  return http(withQuery(`/api/collections`, query));
}
export async function getAlerts(query?: Record<string, string | number | boolean | undefined>): Promise<Alert[]> {
  return http(withQuery(`/api/alerts`, query));
}
export async function createAlertActionTaken(alertId: string, input: Record<string, unknown>): Promise<Alert> {
  return http(`/api/alerts/${alertId}/action-taken`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getCashForecast(query?: { forecast_days?: number }): Promise<ReturnType<typeof import('@/lib/finance').calculateForecast>> {
  return http(withQuery(`/api/cash-forecast`, query));
}
export async function getScenarios(query?: { status?: string }): Promise<Scenario[]> {
  return http(withQuery(`/api/scenarios`, query));
}
export async function createScenario(input: Partial<Omit<Scenario, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Scenario> {
  return http(`/api/scenarios`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getScenarioById(scenarioId: string, query?: Record<string, string | number | boolean | undefined>): Promise<{ scenario: Scenario; baseline: { min_cash: number; first_shortage_date: string | null }; scenario_result: { min_cash: number; first_shortage_date: string | null }; min_cash_change: number; shortage_amount: number; suggested_action: string }> {
  return http(withQuery(`/api/scenarios/${scenarioId}`, query));
}
export async function updateScenario(scenarioId: string, input: Partial<Omit<Scenario, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Scenario> {
  return http(`/api/scenarios/${scenarioId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function createScenarioReset(scenarioId: string, input: Record<string, unknown>): Promise<Scenario> {
  return http(`/api/scenarios/${scenarioId}/reset`, { method: 'POST', body: JSON.stringify(input) });
}
export async function deletePayment(paymentId: string): Promise<void> {
  return http(`/api/payments/${paymentId}`, { method: 'DELETE' });
}
export async function getCashForecastUnscheduled(query?: Record<string, string | number | boolean | undefined>): Promise<any> {
  return http(withQuery(`/api/cash-forecast/unscheduled`, query));
}
