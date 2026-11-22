// Auto-generated from prisma/schema.prisma — canonical InvoiceItem shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export interface InvoiceItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}
