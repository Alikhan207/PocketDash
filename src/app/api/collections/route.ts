import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

type CollectionRow = {
  invoice_id: string;
  customer_name: string;
  invoice_number: string;
  outstanding_amount: number;
  due_date: string;
  expected_collection_date: string | null;
  days_overdue: number;
  is_overdue: boolean;
  last_follow_up_sent_at: string | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toIsoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayInKolkata(): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const sortBy = url.searchParams.get('sort') === 'days_overdue' ? 'days_overdue' : 'outstanding';

    const shop = await prisma.shop.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!shop) {
      return NextResponse.json({ collections: [] });
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        shopId: shop.id,
        status: { in: ['unpaid', 'partially_paid'] },
        ...(q
          ? {
              OR: [
                { invoiceNumber: { contains: q, mode: 'insensitive' } },
                { customer: { name: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        customer: { select: { name: true } },
        payments: { select: { amount: true } },
        followUps: {
          where: { status: 'sent' },
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: { sentAt: true },
        },
      },
    });

    const todayStr = todayInKolkata();
    const todayMs = Date.parse(`${todayStr}T00:00:00Z`);

    const rows: CollectionRow[] = [];

    for (const invoice of invoices) {
      const total = invoice.totalAmount.toNumber();
      const paid = invoice.payments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
      const outstanding = round2(total - paid);

      // Only invoices with an unpaid balance remaining belong in collections
      if (outstanding <= 0) continue;

      const dueStr = toIsoDay(invoice.dueDate);
      const dueMs = Date.parse(`${dueStr}T00:00:00Z`);
      const daysOverdue = Math.round((todayMs - dueMs) / MS_PER_DAY);
      const isOverdue = daysOverdue > 0;

      const lastSent = invoice.followUps[0]?.sentAt ?? null;

      rows.push({
        invoice_id: invoice.id,
        customer_name: invoice.customer.name,
        invoice_number: invoice.invoiceNumber,
        outstanding_amount: outstanding,
        due_date: dueStr,
        expected_collection_date: invoice.expectedCollectionDate
          ? toIsoDay(invoice.expectedCollectionDate)
          : null,
        days_overdue: Math.max(0, daysOverdue),
        is_overdue: isOverdue,
        last_follow_up_sent_at: lastSent ? lastSent.toISOString() : null,
      });
    }

    // Overdue group first, then not-yet-due group; each ordered by the requested sort
    rows.sort((a, b) => {
      if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
      if (sortBy === 'days_overdue') {
        return (
          b.days_overdue - a.days_overdue ||
          b.outstanding_amount - a.outstanding_amount
        );
      }
      return (
        b.outstanding_amount - a.outstanding_amount ||
        b.days_overdue - a.days_overdue
      );
    });

    return NextResponse.json({ collections: rows });
  } catch (e) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}