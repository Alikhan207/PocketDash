// Auto-generated from prisma/schema.prisma — canonical Shop shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export interface Shop {
  id: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  openingCashBalance?: number | string | null;
  openingBalanceEffectiveDate?: string | null;
}
