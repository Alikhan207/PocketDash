import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const MAX_DESCRIPTION_LENGTH = 200;

function isValidPrice(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (value < 0) return false;
  return Math.round(value * 100) / 100 === value;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const shop = await prisma.shop.findUnique({ where: { userId: user.id } });
    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const items = await prisma.savedItem.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
    });

    const savedItems = items.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      shopId: item.shopId,
      description: item.description,
      unitPrice: Number(item.unitPrice),
    }));

    return NextResponse.json({ savedItems });
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

  const input = (body ?? {}) as { description?: unknown; unitPrice?: unknown };

  const description =
    typeof input.description === 'string' ? input.description.trim() : '';
  if (!description) {
    return NextResponse.json(
      {
        error:
          "Enter a description for this item, for example 'Printed T-shirt' or 'Delivery charge'.",
      },
      { status: 400 }
    );
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json(
      { error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.` },
      { status: 400 }
    );
  }

  if (!isValidPrice(input.unitPrice)) {
    return NextResponse.json(
      { error: 'Unit price must be ₹0 or more, with no more than two decimal places.' },
      { status: 400 }
    );
  }
  const unitPrice = input.unitPrice;

  try {
    const shop = await prisma.shop.findUnique({ where: { userId: user.id } });
    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const created = await prisma.savedItem.create({
      data: {
        shopId: shop.id,
        description,
        unitPrice,
      },
    });

    const savedItem = {
      id: created.id,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      shopId: created.shopId,
      description: created.description,
      unitPrice: Number(created.unitPrice),
    };

    return NextResponse.json({ savedItem }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}