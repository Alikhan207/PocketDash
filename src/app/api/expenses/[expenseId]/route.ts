
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const CATEGORIES = ['blank_t_shirts', 'printing', 'yarn', 'packaging', 'delivery', 'other'] as const;
type Category = (typeof CATEGORIES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ expenseId: string }> };

type PatchResult =
  | { data: Prisma.ExpensUpdateInput; amount?: string }
  | { error: string };

function findOwnedExpense(id: string, userId: string) {
  return prisma.expens.findFirst({
    where: { id, shop: { userId } },
  });
}

function handleWriteError(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}

function validatePatch(input: Record<string, unknown>): PatchResult {
  const data: Prisma.ExpensUpdateInput = {};
  let amount: string | undefined;

  if (input.description !== undefined) {
    if (typeof input.description !== 'string' || input.description.trim() === '') {
      return { error: 'Please describe what this bill is for.' };
    }
    const description = input.description.trim();
    if (description.length < 2) {
      return { error: 'Enter a short description of the bill.' };
    }
    data.description = description;
  }

  if (input.category !== undefined) {
    if (typeof input.category !== 'string' || !(CATEGORIES as readonly string[]).includes(input.category)) {
      return { error: 'Choose a bill category.' };
    }
    data.category = input.category as Category;
  }

  if (input.amount !== undefined) {
    const raw = input.amount;
    const s = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
    if (!/^\d+(\.\d{1,2})?$/.test(s) || Number(s) <= 0) {
      return { error: 'Enter an amount greater than ₹0 with no more than two decimal places.' };
    }
    amount = s;
    data.amount = s;
  }

  if (input.dueDate !== undefined) {
    if (typeof input.dueDate !== 'string') {
      return { error: 'Enter the due date as a date, for example 15/07/2025.' };
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(input.dueDate.trim());
    if (!match) {
      return { error: 'Enter the due date as a date, for example 15/07/2025.' };
    }
    const ymd = `${match[1]}-${match[2]}-${match[3]}`;
    const date = new Date(`${ymd}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== ymd) {
      return { error: 'Please enter a valid due date.' };
    }
    data.dueDate = date;
  }

  return { data, amount };
}

export async function GET(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const expenseId = (await params).expenseId;
  if (!UUID_RE.test(expenseId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const expense = await findOwnedExpense(expenseId, user.id);
    if (!expense) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ expense });
  } catch (e) {
    return handleWriteError(e);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const expenseId = (await params).expenseId;
  if (!UUID_RE.test(expenseId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be a JSON object.' }, { status: 400 });
  }

  try {
    const existing = await findOwnedExpense(expenseId, user.id);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const result = validatePatch(body as Record<string, unknown>);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (
      existing.status === 'paid' &&
      result.amount !== undefined &&
      !new Prisma.Decimal(result.amount).equals(existing.amount)
    ) {
      return NextResponse.json({ error: 'Paid bills keep their amount.' }, { status: 409 });
    }

    // Guard in the same statement so a bill marked paid meanwhile can't have its amount changed.
    const guard = result.amount !== undefined
      ? { OR: [{ status: { not: 'paid' as const } }, { amount: new Prisma.Decimal(result.amount) }] }
      : {};
    const updated = await prisma.expens.updateMany({
      where: { id: expenseId, ...guard },
      data: result.data,
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: 'Paid bills keep their amount.' }, { status: 409 });
    }
    const expense = await prisma.expens.findUnique({ where: { id: expenseId } });
    return NextResponse.json({ expense });
  } catch (e) {
    return handleWriteError(e);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const expenseId = (await params).expenseId;
  if (!UUID_RE.test(expenseId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const existing = await findOwnedExpense(expenseId, user.id);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (existing.status === 'paid') {
      return NextResponse.json({ error: 'Paid bills cannot be deleted.' }, { status: 409 });
    }

    const removed = await prisma.expens.deleteMany({ where: { id: expenseId, status: { not: 'paid' } } });
    if (removed.count === 0) {
      return NextResponse.json({ error: 'Paid bills cannot be deleted.' }, { status: 409 });
    }
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return handleWriteError(e);
  }
}