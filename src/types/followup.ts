// Auto-generated from prisma/schema.prisma — canonical FollowUp shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export const FOLLOWUPCHANNEL_VALUES = ['whatsapp', 'copied', 'other'] as const;
export type FollowUpChannel = 'whatsapp' | 'copied' | 'other';
export type FollowUpChannelValue = FollowUpChannel;

export const FOLLOWUPSTATUS_VALUES = ['draft', 'sent'] as const;
export type FollowUpStatus = 'draft' | 'sent';
export type FollowUpStatusValue = FollowUpStatus;

export interface FollowUp {
  id: string;
  createdAt: string;
  updatedAt: string;
  invoiceId: string;
  body: string;
  status: FollowUpStatus;
  channel?: FollowUpChannel | null;
  sentAt?: string | null;
}
