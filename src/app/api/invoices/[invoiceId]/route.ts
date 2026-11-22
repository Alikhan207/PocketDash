import {todayKey} from '@/lib/finance';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

type RouteContext = { params: Promise<{ invoiceId: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function toNumber(value: unknown): number {
  return Number(String(value));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === value ? date : null;
}

// Today's calendar date in Asia/Kolkata, as a UTC-midnight timestamp.
function kolkataTodayUtcMidnight(): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(pick('year'), pick('month') - 1, pick('day'));
}

function dueDateUtcMidnight(dueDate: Date): number {
  return Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
}

function computeDaysOverdue(status: string, outstanding: number, dueDate: Date): number {
  if (status === 'draft' || status === 'cancelled' || status === 'paid') return 0;
  if (outstanding <= 0) return 0;
  const days = Math.round((kolkataTodayUtcMidnight() - dueDateUtcMidnight(dueDate)) / DAY_MS);
  return days > 0 ? days : 0;
}

async function findShopId(userId: string): Promise<string | null> {
  const shop = await prisma.shop.findUnique({ where: { userId }, select: { id: true } });
  return shop?.id ?? null;
}

function handleError(error: unknown): NextResponse {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  console.error(error);
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}

export async function GET(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const invoiceId = (await params).invoiceId;
    if (!UUID_RE.test(invoiceId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const shopId = await findShopId(user.id);
    if (!shopId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, shopId },
      include: {
        customer: true,
        items: { orderBy: { createdAt: 'asc' } },
        payments: { select: { amount: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { customer, items, payments, ...invoiceRow } = invoice;
    const totalAmount = toNumber(invoiceRow.totalAmount);
    const paidTotal = payments.reduce((sum, p) => sum + toNumber(p.amount), 0);
    const outstandingBalance = roundMoney(totalAmount - paidTotal);
    const daysOverdue = computeDaysOverdue(invoiceRow.status, outstandingBalance, invoiceRow.dueDate);

    return NextResponse.json({
      invoice: { ...invoiceRow, totalAmount },
      customer,
      items: items.map((item) => ({
        ...item,
        unitPrice: toNumber(item.unitPrice),
        lineTotal: toNumber(item.lineTotal),
      })),
      outstanding_balance: outstandingBalance,
      days_overdue: daysOverdue,
      is_overdue: daysOverdue > 0,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  try {
    const invoiceId = (await params).invoiceId;
    if (!UUID_RE.test(invoiceId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const shopId = await findShopId(user.id);
    if (!shopId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const existing = await prisma.invoice.findFirst({
      where: { id: invoiceId, shopId },
      include: { payments: { select: { id: true }, take: 1 } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Parse and validate the requested changes.
    let newIssueDate: Date | undefined;
    let newDueDate: Date | undefined;
    let newExpectedDate: Date | null | undefined;
    let newNotes: string | null | undefined;
    let newCustomerId: string | undefined;

    if (body.issueDate !== undefined) {
      const parsed = parseDateOnly(body.issueDate);
      if (!parsed) {
        return NextResponse.json({ error: 'Select an issue date.' }, { status: 400 });
      }
      newIssueDate = parsed;
    }

    if (body.dueDate !== undefined) {
      const parsed = parseDateOnly(body.dueDate);
      if (!parsed) {
        return NextResponse.json({ error: 'Select a payment due date.' }, { status: 400 });
      }
      newDueDate = parsed;
    }

    if (body.expectedCollectionDate !== undefined) {
      if (body.expectedCollectionDate === null) {
        newExpectedDate = null;
      } else {
        const parsed = parseDateOnly(body.expectedCollectionDate);
        if (!parsed) {
          return NextResponse.json(
            { error: 'Enter a valid expected collection date.' },
            { status: 400 },
          );
        }
        if(parsed.toISOString().slice(0,10)<todayKey()) return NextResponse.json({error:'Expected collection date must be today or later.'},{status:400});
        newExpectedDate = parsed;
      }
    }

    if (body.notes !== undefined) {
      if (body.notes === null) {
        newNotes = null;
      } else if (typeof body.notes === 'string') {
        const trimmed = body.notes.trim();
        if (trimmed.length > 500) {
          return NextResponse.json(
            { error: 'Notes must be 500 characters or fewer.' },
            { status: 400 },
          );
        }
        newNotes = trimmed.length > 0 ? trimmed : null;
      } else {
        return NextResponse.json(
          { error: 'Notes must be 500 characters or fewer.' },
          { status: 400 },
        );
      }
    }

    if (body.customerId !== undefined) {
      if (typeof body.customerId !== 'string' || !UUID_RE.test(body.customerId)) {
        return NextResponse.json(
          { error: 'Please choose a customer for this invoice.' },
          { status: 400 },
        );
      }
      const customer = await prisma.customer.findFirst({
        where: { id: body.customerId, shopId },
        select: { id: true },
      });
      if (!customer) {
        return NextResponse.json(
          { error: 'Please choose a customer for this invoice.' },
          { status: 400 },
        );
      }
      newCustomerId = customer.id;
    }

    // Due date may not precede issue date, using the effective values.
    const effectiveIssue = newIssueDate ?? existing.issueDate;
    const effectiveDue = newDueDate ?? existing.dueDate;
    if (dueDateUtcMidnight(effectiveDue) < dueDateUtcMidnight(effectiveIssue)) {
      return NextResponse.json(
        { error: 'Due date cannot be before the issue date.' },
        { status: 400 },
      );
    }

    // Once payments exist, the customer and the dates are locked.
    const hasPayments = existing.payments.length > 0;
    const customerChanged = newCustomerId !== undefined && newCustomerId !== existing.customerId;
    const issueChanged =
      newIssueDate !== undefined && newIssueDate.getTime() !== existing.issueDate.getTime();
    const dueChanged =
      newDueDate !== undefined && newDueDate.getTime() !== existing.dueDate.getTime();

    if (hasPayments && (customerChanged || issueChanged || dueChanged)) {
      return NextResponse.json(
        {
          error:
            'This invoice already has payments, so its customer and dates cannot be changed.',
        },
        { status: 409 },
      );
    }

    const data: Prisma.InvoiceUncheckedUpdateInput = {};
    if (newIssueDate !== undefined) data.issueDate = newIssueDate;
    if (newDueDate !== undefined) data.dueDate = newDueDate;
    if (newExpectedDate !== undefined) data.expectedCollectionDate = newExpectedDate;
    if (newNotes !== undefined) data.notes = newNotes;
    if (newCustomerId !== undefined) data.customerId = newCustomerId;

    const invoice = await prisma.invoice.update({
      where: { id: existing.id },
      data,
    });

    return NextResponse.json({
      invoice: { ...invoice, totalAmount: toNumber(invoice.totalAmount) },
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const invoiceId = (await params).invoiceId;
    if (!UUID_RE.test(invoiceId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const shopId = await findShopId(user.id);
    if (!shopId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const existing = await prisma.invoice.findFirst({
      where: { id: invoiceId, shopId },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'Issued invoices cannot be deleted. Cancel them instead.' },
        { status: 409 },
      );
    }

    // Items, payments and follow-ups cascade from the invoice.
    await prisma.invoice.delete({ where: { id: existing.id } });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}