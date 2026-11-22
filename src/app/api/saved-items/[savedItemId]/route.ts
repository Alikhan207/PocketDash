
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

type RouteContext = { params: Promise<{ savedItemId: string }> };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DESCRIPTION_ERROR =
  "Enter a description for this item, for example 'Printed T-shirt' or 'Delivery charge'.";
const UNIT_PRICE_ERROR = 'Unit price must be ₹0 or more, with no more than two decimal places.';

function parseUnitPrice(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  const paise = Math.round(value * 100);
  if (Math.abs(value * 100 - paise) > 1e-6) {
    return null;
  }
  return Number((paise / 100).toFixed(2));
}

function toWire<T extends { unitPrice: Prisma.Decimal }>(
  item: T,
): Omit<T, 'unitPrice'> & { unitPrice: number } {
  return { ...item, unitPrice: Number(item.unitPrice.toString()) };
}

async function findOwnedSavedItem(userId: string, savedItemId: string) {
  const shop = await prisma.shop.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!shop) {
    return null;
  }
  return prisma.savedItem.findFirst({
    where: { id: savedItemId, shopId: shop.id },
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const savedItemId = (await params).savedItemId;
  if (!UUID_PATTERN.test(savedItemId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const data: { description?: string; unitPrice?: number } = {};

  if ('description' in input) {
    if (typeof input.description !== 'string' || input.description.trim() === '') {
      return NextResponse.json({ error: DESCRIPTION_ERROR }, { status: 400 });
    }
    data.description = input.description.trim();
  }

  if ('unitPrice' in input) {
    const unitPrice = parseUnitPrice(input.unitPrice);
    if (unitPrice === null) {
      return NextResponse.json({ error: UNIT_PRICE_ERROR }, { status: 400 });
    }
    data.unitPrice = unitPrice;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
  }

  try {
    const existing = await findOwnedSavedItem(user.id, savedItemId);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const savedItem = await prisma.savedItem.update({
      where: { id: existing.id },
      data,
    });

    return NextResponse.json({ savedItem: toWire(savedItem) });
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

  const savedItemId = (await params).savedItemId;
  if (!UUID_PATTERN.test(savedItemId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const existing = await findOwnedSavedItem(user.id, savedItemId);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.savedItem.delete({ where: { id: existing.id } });

    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}