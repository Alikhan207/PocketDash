// Auto-generated from the reviewed schema — canonical Expens shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export interface Expens {
  id: string;
  createdAt: string;
  updatedAt: string;
  shopId: string;
  description: string;
  category: 'blank_t_shirts' | 'printing' | 'yarn' | 'packaging' | 'delivery' | 'other';
  amount: number;
  dueDate: string;
  status: string;
  paidOn?: string | null;
  revisedPaymentDate?: string | null;
}
