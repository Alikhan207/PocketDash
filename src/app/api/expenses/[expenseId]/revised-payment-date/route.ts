import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns today's calendar date (YYYY-MM-DD) on the Asia/Kolkata calendar. */
function kolkataToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Accepts YYYY-MM-DD (date picker value) or DD/MM/YYYY.
 * Returns a normalised YYYY-MM-DD string, or null when the input is not a real calendar date.
 */
function toIsoDate(raw: string): string | null {
  const trimmed = raw.trim();
  let year: number;
  let month: number;
  let day: number;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  } else {
    return null;
  }

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return probe.toISOString().slice(0, 10);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ expenseId: string }> }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { expenseId } = await params;
  if (!UUID_RE.test(expenseId)) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rawValue =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>).revised_payment_date
      : undefined;

  if (typeof rawValue !== 'string' || rawValue.trim() === '') {
    return NextResponse.json(
      { error: 'Enter the expected payment date.' },
      { status: 400 }
    );
  }

  const revisedIso = toIsoDate(rawValue);
  if (!revisedIso) {
    return NextResponse.json(
      { error: 'Enter the expected payment date as a date, for example 15/07/2025.' },
      { status: 400 }
    );
  }

  if (revisedIso < kolkataToday()) {
    return NextResponse.json(
      { error: 'The expected payment date must be today or a later date.' },
      { status: 400 }
    );
  }

  try {
    const shop = await prisma.shop.findUnique({ where: { userId: user.id } });
    if (!shop) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const expense = await prisma.expens.findFirst({
      where: { id: expenseId, shopId: shop.id },
    });
    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    if (expense.status === 'paid') {
      return NextResponse.json(
        { error: 'A paid bill cannot have a revised payment date.' },
        { status: 409 }
      );
    }

    const updated = await prisma.expens.update({
      where: { id: expense.id },
      data: { revisedPaymentDate: new Date(`${revisedIso}T00:00:00.000Z`) },
    });

    return NextResponse.json({ expense: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}