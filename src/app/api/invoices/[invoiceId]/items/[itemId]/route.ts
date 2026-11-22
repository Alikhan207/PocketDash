import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

type RouteContext = { params: Promise<{ invoiceId: string; itemId: string }> };

const EDITABLE_STATUSES: string[] = ['draft', 'unpaid'];
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

async function loadItemForOwner(userId: string, invoiceId: string, itemId: string) {
  return prisma.invoiceItem.findFirst({
    where: {
      id: itemId,
      invoiceId,
      invoice: { shop: { userId } },
    },
    include: {
      invoice: { select: { id: true, status: true } },
    },
  });
}

async function blockedReason(invoiceId: string, status: string): Promise<NextResponse | null> {
  if (!EDITABLE_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: 'Items can only be changed on a draft or unpaid invoice.' },
      { status: 409 },
    );
  }
  const paymentCount = await prisma.payment.count({ where: { invoiceId } });
  if (paymentCount > 0) {
    return NextResponse.json(
      { error: 'Items cannot be changed after a payment is recorded.' },
      { status: 409 },
    );
  }
  return null;
}

async function recalculateTotal(
  tx: Prisma.TransactionClient,
  invoiceId: string,
): Promise<Prisma.Decimal> {
  const agg = await tx.invoiceItem.aggregate({
    where: { invoiceId },
    _sum: { lineTotal: true },
  });
  const total = agg._sum.lineTotal ?? new Prisma.Decimal(0);
  await tx.invoice.update({
    where: { id: invoiceId },
    data: { totalAmount: total },
  });
  return total;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  const { invoiceId, itemId } = await params;
  if (!isUuid(invoiceId) || !isUuid(itemId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let nextDescription: string | undefined;
  if (input.description !== undefined) {
    if (typeof input.description !== 'string' || input.description.trim() === '') {
      return NextResponse.json(
        { error: "Enter a description for this item, for example 'Printed T-shirt' or 'Delivery charge'." },
        { status: 400 },
      );
    }
    nextDescription = input.description.trim();
  }

  let nextQuantity: number | undefined;
  if (input.quantity !== undefined) {
    if (typeof input.quantity !== 'number' || !Number.isInteger(input.quantity) || input.quantity < 1) {
      return NextResponse.json(
        { error: 'Quantity must be a whole number of 1 or more.' },
        { status: 400 },
      );
    }
    nextQuantity = input.quantity;
  }

  let nextUnitPrice: Prisma.Decimal | undefined;
  const rawUnitPrice = input.unitPrice !== undefined ? input.unitPrice : input.unit_price;
  if (rawUnitPrice !== undefined) {
    const asText = typeof rawUnitPrice === 'number' ? String(rawUnitPrice) : rawUnitPrice;
    if (typeof asText !== 'string' || !MONEY_PATTERN.test(asText)) {
      return NextResponse.json(
        { error: 'Unit price must be ₹0 or more, with no more than two decimal places.' },
        { status: 400 },
      );
    }
    nextUnitPrice = new Prisma.Decimal(asText);
  }

  try {
    const existing = await loadItemForOwner(user.id, invoiceId, itemId);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const blocked = await blockedReason(existing.invoice.id, existing.invoice.status);
    if (blocked) return blocked;

    const description = nextDescription ?? existing.description;
    const quantity = nextQuantity ?? existing.quantity;
    const unitPrice = nextUnitPrice ?? existing.unitPrice;
    const lineTotal = new Prisma.Decimal(quantity).times(unitPrice);

    if (lineTotal.isNegative()) {
      return NextResponse.json(
        { error: 'The line total could not be calculated. Check the quantity and unit price and try again.' },
        { status: 400 },
      );
    }

    const item = await prisma.$transaction(async (tx) => {
      const updatedItem = await tx.invoiceItem.update({
        where: { id: itemId },
        data: { description, quantity, unitPrice, lineTotal },
      });
      await recalculateTotal(tx, invoiceId);
      return updatedItem;
    });

    return NextResponse.json({ item });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { invoiceId, itemId } = await params;
  if (!isUuid(invoiceId) || !isUuid(itemId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const existing = await loadItemForOwner(user.id, invoiceId, itemId);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const blocked = await blockedReason(existing.invoice.id, existing.invoice.status);
    if (blocked) return blocked;

    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.invoiceItem.count({ where: { invoiceId } });
      if (count <= 1) {
        return { refused: true as const };
      }
      await tx.invoiceItem.delete({ where: { id: itemId } });
      const total = await recalculateTotal(tx, invoiceId);
      return { refused: false as const, total };
    });

    if (result.refused) {
      return NextResponse.json(
        { error: 'An invoice must keep at least one item.' },
        { status: 409 },
      );
    }

    return NextResponse.json({
      deleted: true,
      total_amount: Number(result.total.toString()),
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}