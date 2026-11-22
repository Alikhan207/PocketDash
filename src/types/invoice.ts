// Auto-generated from prisma/schema.prisma — canonical Invoice shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export const INVOICESTATUS_VALUES = ['draft', 'unpaid', 'partially_paid', 'paid', 'cancelled'] as const;
export type InvoiceStatus = 'draft' | 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';
export type InvoiceStatusValue = InvoiceStatus;

export interface Invoice {
  id: string;
  createdAt: string;
  updatedAt: string;
  shopId: string;
  customerId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  expectedCollectionDate?: string | null;
  totalAmount: string;
  notes?: string | null;
}
