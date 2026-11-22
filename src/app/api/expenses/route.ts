import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CATEGORIES = [
  'blank_t_shirts',
  'printing',
  'yarn',
  'packaging',
  'delivery',
  'other',
] as const;
type Category = (typeof CATEGORIES)[number];

const STATUSES = ['unpaid', 'paid'] as const;
type Status = (typeof STATUSES)[number];

type ExpenseRow = Awaited<ReturnType<typeof prisma.expens.findMany>>[number];

function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is Status {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

/** Today's calendar date in Asia/Kolkata, formatted YYYY-MM-DD. */
function kolkataToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). Positive when `to` is later. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

function serialize(row: ExpenseRow) {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    shopId: row.shopId,
    description: row.description,
    category: row.category as Category,
    amount: Number(row.amount.toString()),
    dueDate: toDateOnly(row.dueDate),
    status: row.status as Status,
    paidOn: row.paidOn ? toDateOnly(row.paidOn) : null,
    revisedPaymentDate: row.revisedPaymentDate ? toDateOnly(row.revisedPaymentDate) : null,
  };
}

function annotate(row: ExpenseRow, today: string) {
  const expense = serialize(row);

  if (expense.status === 'paid') {
    return {
      ...expense,
      is_overdue: false,
      days_overdue: 0,
      counted_in_forecast_on: expense.paidOn ?? expense.dueDate,
    };
  }

  const effective = expense.revisedPaymentDate ?? expense.dueDate;
  const daysLate = daysBetween(effective, today);
  const isOverdue = daysLate > 0;

  return {
    ...expense,
    is_overdue: isOverdue,
    days_overdue: isOverdue ? daysLate : 0,
    // An overdue unpaid bill is an outflow today until a revised date is set.
    counted_in_forecast_on: isOverdue ? today : effective,
  };
}

/** Accepts YYYY-MM-DD or DD/MM/YYYY. Returns a UTC-midnight Date, or null if invalid. */
function parseDateInput(raw: string): { date: Date | null; recognised: boolean } {
  let year: number;
  let month: number;
  let day: number;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  } else {
    return { date: null, recognised: false };
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  return { date: valid ? date : null, recognised: true };
}

function parseAmount(raw: unknown): number | null {
  let n: number;
  if (typeof raw === 'number') {
    n = raw;
  } else if (typeof raw === 'string' && raw.trim() !== '') {
    n = Number(raw.trim());
  } else {
    return null;
  }
  if (!Number.isFinite(n) || n <= 0) return null;
  if (Number(n.toFixed(2)) !== n) return null;
  return n;
}

async function getShopId(userId: string): Promise<string | null> {
  const shop = await prisma.shop.findUnique({
    where: { userId },
    select: { id: true },
  });
  return shop?.id ?? null;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const shopId = await getShopId(user.id);
    if (!shopId) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const categoryParam = url.searchParams.get('category') ?? '';
    const statusParam = url.searchParams.get('status') ?? '';

    if (categoryParam && categoryParam !== 'all' && !isCategory(categoryParam)) {
      return NextResponse.json({ error: 'Unknown category' }, { status: 400 });
    }
    if (statusParam && statusParam !== 'all' && !isStatus(statusParam)) {
      return NextResponse.json({ error: 'Unknown status' }, { status: 400 });
    }

    const category: Category | undefined =
      categoryParam && categoryParam !== 'all' && isCategory(categoryParam)
        ? categoryParam
        : undefined;
    const status: Status | undefined =
      statusParam && statusParam !== 'all' && isStatus(statusParam) ? statusParam : undefined;

    const rows = await prisma.expens.findMany({
      where: {
        shopId,
        ...(category ? { category } : {}),
        ...(status ? { status } : {}),
        ...(q ? { description: { contains: q, mode: 'insensitive' as const } } : {}),
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });

    const today = kolkataToday();
    const expenses = rows.map((row) => annotate(row, today));

    return NextResponse.json({ expenses });
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

  const input: Record<string, unknown> =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  // Description: required, at least 2 non-blank characters.
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (description.length < 2) {
    return NextResponse.json(
      { error: 'Enter a short description of the bill.' },
      { status: 400 },
    );
  }

  // Category: required, one of the six listed categories.
  if (!isCategory(input.category)) {
    return NextResponse.json({ error: 'Choose a bill category.' }, { status: 400 });
  }
  const category: Category = input.category;

  // Amount: positive rupees with at most two decimal places.
  const amount = parseAmount(input.amount);
  if (amount === null) {
    return NextResponse.json(
      { error: 'Enter an amount greater than ₹0 with no more than two decimal places.' },
      { status: 400 },
    );
  }

  // Due date: required, recognised format, valid calendar date.
  if (typeof input.dueDate !== 'string' || input.dueDate.trim() === '') {
    return NextResponse.json({ error: "Enter the bill's due date." }, { status: 400 });
  }
  const parsed = parseDateInput(input.dueDate.trim());
  if (!parsed.recognised) {
    return NextResponse.json(
      { error: 'Enter the due date as a date, for example 15/07/2025.' },
      { status: 400 },
    );
  }
  if (!parsed.date) {
    return NextResponse.json({ error: 'Please enter a valid due date.' }, { status: 400 });
  }
  const dueDate = parsed.date;

  try {
    const shopId = await getShopId(user.id);
    if (!shopId) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const created = await prisma.expens.create({
      data: {
        shopId,
        description,
        category,
        amount: amount.toFixed(2),
        dueDate,
        status: 'unpaid',
      },
    });

    return NextResponse.json(
      { expense: annotate(created, kolkataToday()) },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}