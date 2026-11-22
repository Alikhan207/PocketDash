// Auto-generated from prisma/schema.prisma — canonical Customer shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export interface Customer {
  id: string;
  createdAt: string;
  updatedAt: string;
  shopId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}
