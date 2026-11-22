import {randomUUID} from 'node:crypto';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const MAX_SEARCH_LENGTH = 100;
const MAX_INVOICE_NUMBER_LENGTH = 30;
const MAX_NOTES_LENGTH = 500;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const SORT_OPTIONS = ['due_date', 'outstanding', 'days_overdue', 'customer'] as const;
const FILTER_OPTIONS = ['all', 'overdue', 'not_due'] as const;

type SortOption = (typeof SORT_OPTIONS)[number];
type FilterOption = (typeof FILTER_OPTIONS)[number];

type InvoiceRow = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  shopId: string;
  customerId: string;
  invoiceNumber: string;
  status: string;
  issueDate: Date;
  dueDate: Date;
  expectedCollectionDate: Date | null;
  totalAmount: Prisma.Decimal;
  notes: string | null;
};

function toNumber(value: { toString(): string } | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value.toString());
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Today's calendar date in Asia/Kolkata, as a UTC-midnight Date (matches @db.Date values). */
function todayInKolkata(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(`${parts}T00:00:00.000Z`);
}

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || toDateOnly(date) !== value) return null;
  return date;
}

function dayDifference(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 86_400_000);
}

function pickValue(source: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined) return source[key];
  }
  return undefined;
}

function serializeInvoice(
  invoice: InvoiceRow,
  customerName: string,
  outstandingBalance: number,
  daysOverdue: number,
  isOverdue: boolean,
) {
  return {
    id: invoice.id,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    shopId: invoice.shopId,
    customerId: invoice.customerId,
    customerName,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    issueDate: toDateOnly(invoice.issueDate),
    dueDate: toDateOnly(invoice.dueDate),
    expectedCollectionDate: invoice.expectedCollectionDate
      ? toDateOnly(invoice.expectedCollectionDate)
      : null,
    totalAmount: toNumber(invoice.totalAmount),
    notes: invoice.notes,
    outstandingBalance,
    daysOverdue,
    isOverdue,
    customer_name: customerName,
    outstanding_balance: outstandingBalance,
    days_overdue: daysOverdue,
    is_overdue: isOverdue,
  };
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const sortParam = url.searchParams.get('sort') ?? 'due_date';
  const filterParam = url.searchParams.get('filter') ?? 'all';

  if (q.length > MAX_SEARCH_LENGTH) {
    return NextResponse.json(
      { error: 'Search is limited to 100 characters. Shorten it to keep searching.' },
      { status: 400 },
    );
  }
  if (!(SORT_OPTIONS as readonly string[]).includes(sortParam)) {
    return NextResponse.json(
      { error: 'Choose a sort option: customer, outstanding amount, or due date.' },
      { status: 400 },
    );
  }
  if (!(FILTER_OPTIONS as readonly string[]).includes(filterParam)) {
    return NextResponse.json({ error: 'Choose a filter: all, overdue, or not due.' }, { status: 400 });
  }
  const sort = sortParam as SortOption;
  const filter = filterParam as FilterOption;

  try {
    const shop = await prisma.shop.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const rows = await prisma.invoice.findMany({
      where: {
        shopId: shop.id,
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
      },
    });

    const today = todayInKolkata();

    const computed = rows.map((row) => {
      const paid = row.payments.reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Prisma.Decimal(0),
      );
      const outstandingDecimal = new Prisma.Decimal(row.totalAmount).minus(paid);
      const outstandingBalance = toNumber(outstandingDecimal);
      const isOpen = row.status === 'unpaid' || row.status === 'partially_paid';
      const hasBalance = isOpen && outstandingBalance > 0;
      const daysOverdue = hasBalance ? Math.max(0, dayDifference(today, row.dueDate)) : 0;
      const isOverdue = hasBalance && daysOverdue > 0;

      return {
        row,
        customerName: row.customer.name,
        outstandingBalance,
        daysOverdue,
        isOverdue,
        hasBalance,
      };
    });

    const filtered = computed.filter((item) => {
      if (filter === 'overdue') return item.isOverdue;
      if (filter === 'not_due') return item.hasBalance && !item.isOverdue;
      return true;
    });

    filtered.sort((a, b) => {
      switch (sort) {
        case 'customer':
          return a.customerName.localeCompare(b.customerName);
        case 'outstanding':
          return b.outstandingBalance - a.outstandingBalance;
        case 'days_overdue':
          return b.daysOverdue - a.daysOverdue;
        case 'due_date':
        default:
          return a.row.dueDate.getTime() - b.row.dueDate.getTime();
      }
    });

    const invoices = filtered.map((item) =>
      serializeInvoice(
        item.row,
        item.customerName,
        item.outstandingBalance,
        item.daysOverdue,
        item.isOverdue,
      ),
    );

    return NextResponse.json({ invoices });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  const customerId = pickValue(input, 'customer_id', 'customerId');
  if (typeof customerId !== 'string' || !UUID_PATTERN.test(customerId)) {
    return NextResponse.json({ error: 'Please choose a customer for this invoice.' }, { status: 400 });
  }

  const rawInvoiceNumber = pickValue(input, 'invoice_number', 'invoiceNumber');
  const invoiceNumber = (typeof rawInvoiceNumber === 'string' ? rawInvoiceNumber.trim() : '') || 'PD-'+randomUUID().slice(0,12).toUpperCase();
  if (!invoiceNumber) {
    return NextResponse.json({ error: 'Enter an invoice number.' }, { status: 400 });
  }
  if (invoiceNumber.length > MAX_INVOICE_NUMBER_LENGTH) {
    return NextResponse.json(
      { error: 'Invoice number must be 30 characters or fewer.' },
      { status: 400 },
    );
  }

  const issueDate = parseDateOnly(pickValue(input, 'issue_date', 'issueDate'));
  if (!issueDate) {
    return NextResponse.json({ error: 'Select an issue date.' }, { status: 400 });
  }

  const dueDate = parseDateOnly(pickValue(input, 'due_date', 'dueDate'));
  if (!dueDate) {
    return NextResponse.json({ error: 'Select a payment due date.' }, { status: 400 });
  }
  if (dueDate.getTime() < issueDate.getTime()) {
    return NextResponse.json(
      { error: 'Due date cannot be before the issue date.' },
      { status: 400 },
    );
  }

  const rawNotes = input.notes;
  let notes: string | null = null;
  if (rawNotes !== undefined && rawNotes !== null) {
    if (typeof rawNotes !== 'string') {
      return NextResponse.json({ error: 'Notes must be text.' }, { status: 400 });
    }
    const trimmedNotes = rawNotes.trim();
    if (trimmedNotes.length > MAX_NOTES_LENGTH) {
      return NextResponse.json(
        { error: 'Notes must be 500 characters or fewer.' },
        { status: 400 },
      );
    }
    notes = trimmedNotes.length > 0 ? trimmedNotes : null;
  }

  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 100) {
    return NextResponse.json({ error: 'Items must be a list.' }, { status: 400 });
  }

  const parsedItems: {
    savedItemId: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
  }[] = [];

  for (const rawItem of input.items) {
    if (typeof rawItem !== 'object' || rawItem === null) {
      return NextResponse.json({ error: 'Each item must be an object.' }, { status: 400 });
    }
    const item = rawItem as Record<string, unknown>;

    const description = typeof item.description === 'string' ? item.description.trim() : '';
    if (!description) {
      return NextResponse.json(
        { error: 'Enter a description for each item.' },
        { status: 400 },
      );
    }

    const quantity = item.quantity;
    if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 100000) {
      return NextResponse.json(
        { error: 'Quantity must be a whole number greater than zero.' },
        { status: 400 },
      );
    }

    const unitPrice = pickValue(item, 'unit_price', 'unitPrice');
    if (typeof unitPrice !== 'number' || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 10000000 || Math.abs(unitPrice*100-Math.round(unitPrice*100))>0.00001) {
      return NextResponse.json(
        { error: 'Unit price must be non-negative with at most two decimal places.' },
        { status: 400 },
      );
    }

    const rawSavedItemId = pickValue(item, 'saved_item_id', 'savedItemId');
    let savedItemId: string | null = null;
    if (rawSavedItemId !== undefined && rawSavedItemId !== null) {
      if (typeof rawSavedItemId !== 'string' || !UUID_PATTERN.test(rawSavedItemId)) {
        return NextResponse.json({ error: 'Saved item not found.' }, { status: 400 });
      }
      savedItemId = rawSavedItemId;
    }

    parsedItems.push({ savedItemId, description, quantity, unitPrice });
  }

  try {
    const shop = await prisma.shop.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, shopId: shop.id },
      select: { id: true, name: true },
    });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const duplicate = await prisma.invoice.findFirst({
      where: { shopId: shop.id, invoiceNumber },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: 'This invoice number is already used. Enter a different number.' },
        { status: 409 },
      );
    }

    for (const item of parsedItems) {
      if (item.savedItemId) {
        const savedItem = await prisma.savedItem.findFirst({
          where: { id: item.savedItemId, shopId: shop.id },
          select: { id: true },
        });
        if (!savedItem) {
          return NextResponse.json({ error: 'Saved item not found.' }, { status: 400 });
        }
      }
    }

    const itemRows = parsedItems.map((item) => {
      const unitPrice = new Prisma.Decimal(item.unitPrice);
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice.times(item.quantity),
      };
    });

    const totalAmount = itemRows.reduce(
      (sum, item) => sum.plus(item.lineTotal),
      new Prisma.Decimal(0),
    );

    if(totalAmount.gt(9999999999.99)) return NextResponse.json({error:'Invoice total exceeds the supported range.'},{status:400});
    const invoice = await prisma.invoice.create({
      data: {
        shopId: shop.id,
        customerId: customer.id,
        invoiceNumber,
        status: 'draft',
        issueDate,
        dueDate,
        notes,
        totalAmount,
        items: { create: itemRows },
      },
    });

    const today = todayInKolkata();
    const daysOverdue = 0;
    const isOverdue = false;
    void today;

    return NextResponse.json(
      {
        invoice: serializeInvoice(
          invoice,
          customer.name,
          toNumber(totalAmount),
          daysOverdue,
          isOverdue,
        ),
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}