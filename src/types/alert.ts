// Auto-generated from prisma/schema.prisma — canonical Alert shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export const ALERTSTATUS_VALUES = ['active', 'resolved'] as const;
export type AlertStatus = 'active' | 'resolved';
export type AlertStatusValue = AlertStatus;

export const ALERTTYPE_VALUES = ['overdue_invoice', 'upcoming_bill', 'cash_shortage', 'overdue_no_expected_date'] as const;
export type AlertType = 'overdue_invoice' | 'upcoming_bill' | 'cash_shortage' | 'overdue_no_expected_date';
export type AlertTypeValue = AlertType;

export interface Alert {
  id: string;
  createdAt: string;
  updatedAt: string;
  shopId: string;
  alertType: AlertType;
  status: AlertStatus;
  invoiceId?: string | null;
  expenseId?: string | null;
  shortageDate?: string | null;
  shortageAmount?: string | null;
  message: string;
  actionTakenAt?: string | null;
  resolvedAt?: string | null;
}
