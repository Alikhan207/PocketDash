import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function parsePaidOn(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  let y: number;
  let m: number;
  let d: number;

  const iso = ISO_RE.exec(s);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else {
    const dmy = DMY_RE.exec(s);
    if (!dmy) return null;
    d = Number(dmy[1]);
    m = Number(dmy[2]);
    y = Number(dmy[3]);
  }

  const check = new Date(Date.UTC(y, m - 1, d));
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  ) {
    return null;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}`;
}

function todayInKolkata(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ expenseId: string }> },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const paidOnRaw =
    typeof body === 'object' && body !== null
      ? (body as { paid_on?: unknown }).paid_on
      : undefined;

  if (paidOnRaw === undefined || paidOnRaw === null || paidOnRaw === '') {
    return NextResponse.json(
      { error: 'Enter the date this bill was paid.' },
      { status: 400 },
    );
  }

  const paidOn = parsePaidOn(paidOnRaw);
  if (!paidOn) {
    return NextResponse.json(
      { error: 'Enter the date this bill was paid as a date, for example 15/07/2025.' },
      { status: 400 },
    );
  }

  if (paidOn > todayInKolkata()) {
    return NextResponse.json(
      { error: 'The paid date cannot be in the future.' },
      { status: 400 },
    );
  }

  const expenseId = (await params).expenseId;
  if (!UUID_RE.test(expenseId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const shop = await prisma.shop.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!shop) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const expense = await prisma.expens.findFirst({
      where: { id: expenseId, shopId: shop.id },
    });
    if (!expense) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (expense.status === 'paid') {
      return NextResponse.json(
        { error: 'This bill has already been paid.' },
        { status: 409 },
      );
    }

    const [updated] = await prisma.$transaction([
      prisma.expens.update({
        where: { id: expense.id },
        data: {
          status: 'paid',
          paidOn: new Date(`${paidOn}T00:00:00.000Z`),
        },
      }),
      prisma.alert.updateMany({
        where: { expenseId: expense.id, resolvedAt: null },
        data: { resolvedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ expense: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}