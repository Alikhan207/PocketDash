import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

type RouteContext = { params: Promise<{ invoiceId: string }> };

const SHOP_TIMEZONE = 'Asia/Kolkata';

function todayInShopTimezone(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SHOP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.UTC(
    Number(fromIso.slice(0, 4)),
    Number(fromIso.slice(5, 7)) - 1,
    Number(fromIso.slice(8, 10)),
  );
  const to = Date.UTC(
    Number(toIso.slice(0, 4)),
    Number(toIso.slice(5, 7)) - 1,
    Number(toIso.slice(8, 10)),
  );
  return Math.round((to - from) / 86400000);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatDueDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await requireUser(_request);
  if (user instanceof Response) return user;

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: (await params).invoiceId, shop: { userId: user.id } },
      select: { id: true },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const followUps = await prisma.followUp.findMany({
      where: { invoiceId: invoice.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ followUps });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: (await params).invoiceId, shop: { userId: user.id } },
      include: { customer: true },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (invoice.status === 'draft' || invoice.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Reminders can only be drafted for issued invoices.' },
        { status: 409 },
      );
    }

    const paidAgg = await prisma.payment.aggregate({
      where: { invoiceId: invoice.id },
      _sum: { amount: true },
    });
    const paid = Number(paidAgg._sum.amount ?? 0);
    const outstanding = roundMoney(Number(invoice.totalAmount) - paid);

    if (invoice.status === 'paid' || outstanding <= 0) {
      return NextResponse.json(
        { error: 'This invoice is already fully paid.' },
        { status: 409 },
      );
    }

    const dueIso = invoice.dueDate.toISOString().slice(0, 10);
    const daysOverdue = Math.max(0, daysBetween(dueIso, todayInShopTimezone()));
    const dueLabel = formatDueDate(invoice.dueDate);
    const customerName = invoice.customer?.name ?? 'there';

    const lateNote =
      daysOverdue > 0
        ? ` It is now ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} past the due date.`
        : '';

    const body =
      `Hi ${customerName}, a friendly reminder about invoice ${invoice.invoiceNumber}. ` +
      `The outstanding balance is ₹${outstanding.toFixed(2)}, due on ${dueLabel}.` +
      lateNote +
      ' Could you please let me know when the payment is made? Thank you!';

    const followUp = await prisma.followUp.create({
      data: {
        invoiceId: invoice.id,
        body,
        status: 'draft',
      },
    });

    return NextResponse.json({ followUp }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}