// Auto-generated from prisma/schema.prisma — canonical User shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export interface User {
  id: string;
  createdAt: string;
  updatedAt: string;
  email: string;
  name: string;
  clerkUserId: string;
  isDemo: boolean;
  lastSignedInAt?: string | null;
  lastSignedOutAt?: string | null;
  deletedAt?: string | null;
}
