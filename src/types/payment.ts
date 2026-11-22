// Auto-generated from prisma/schema.prisma — canonical Payment shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export const PAYMENTKIND_VALUES = ['advance', 'partial', 'final'] as const;
export type PaymentKind = 'advance' | 'partial' | 'final';
export type PaymentKindValue = PaymentKind;

export const PAYMENTMETHOD_VALUES = ['cash', 'upi', 'bank_transfer', 'card', 'other'] as const;
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'card' | 'other';
export type PaymentMethodValue = PaymentMethod;

export const PAYMENTVERIFICATIONSTATUS_VALUES = ['seller_recorded'] as const;
export type PaymentVerificationStatus = 'seller_recorded';
export type PaymentVerificationStatusValue = PaymentVerificationStatus;

export interface Payment {
  id: string;
  createdAt: string;
  updatedAt: string;
  invoiceId: string;
  amount: string;
  paidOn: string;
  method: PaymentMethod;
  kind: PaymentKind;
  verificationStatus: PaymentVerificationStatus;
  idempotencyKey: string;
}
