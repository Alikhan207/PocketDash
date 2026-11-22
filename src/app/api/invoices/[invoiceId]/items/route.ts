import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

type RouteContext = { params: Promise<{ invoiceId: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_INT = 2147483647;
const MAX_MONEY = 9999999999.99;

type ParsedItem = {
  description: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

type ParseResult = { ok: true; value: ParsedItem } | { ok: false; error: string };

function parseItemBody(body: unknown): ParseResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return {
      ok: false,
      error: "Enter a description for this item, for example 'Printed T-shirt' or 'Delivery charge'.",
    };
  }
  const b = body as Record<string, unknown>;

  const description = typeof b.description === 'string' ? b.description.trim() : '';
  if (!description) {
    return {
      ok: false,
      error: "Enter a description for this item, for example 'Printed T-shirt' or 'Delivery charge'.",
    };
  }

  const quantity = b.quantity;
  if (
    typeof quantity !== 'number' ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_INT
  ) {
    return { ok: false, error: 'Quantity must be a whole number of 1 or more.' };
  }

  const rawPrice =
    typeof b.unit_price === 'number'
      ? String(b.unit_price)
      : typeof b.unit_price === 'string'
        ? b.unit_price.trim()
        : '';
  if (!/^\d+(\.\d{1,2})?$/.test(rawPrice) || Number(rawPrice) > MAX_MONEY) {
    return {
      ok: false,
      error: 'Unit price must be ₹0 or more, with no more than two decimal places.',
    };
  }

  const unitPrice = new Prisma.Decimal(rawPrice);
  const lineTotal = unitPrice.mul(quantity).toDecimalPlaces(2);
  if (lineTotal.isNegative() || lineTotal.gt(MAX_MONEY)) {
    return {
      ok: false,
      error:
        'The line total could not be calculated. Check the quantity and unit price and try again.',
    };
  }

  return { ok: true, value: { description, quantity, unitPrice, lineTotal } };
}

type TxResult =
  | { kind: 'notFound' }
  | { kind: 'closed' }
  | { kind: 'hasPayments' }
  | { kind: 'ok'; item: unknown };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { invoiceId } = await params;
  if (!UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, shop: { userId: user.id } },
      select: { id: true },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const items = await prisma.invoiceItem.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { invoiceId } = await params;
  if (!UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = parseItemBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const input = parsed.value;

  try {
    const result: TxResult = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, shop: { userId: user.id } },
        select: { id: true, status: true },
      });
      if (!invoice) return { kind: 'notFound' };

      if (invoice.status !== 'draft' && invoice.status !== 'unpaid') {
        return { kind: 'closed' };
      }

      const paymentCount = await tx.payment.count({ where: { invoiceId } });
      if (paymentCount > 0) return { kind: 'hasPayments' };

      const item = await tx.invoiceItem.create({
        data: {
          invoiceId,
          description: input.description,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          lineTotal: input.lineTotal,
        },
      });

      const agg = await tx.invoiceItem.aggregate({
        where: { invoiceId },
        _sum: { lineTotal: true },
      });
      const total = agg._sum.lineTotal ?? new Prisma.Decimal(0);

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { totalAmount: total },
      });

      return { kind: 'ok', item };
    });

    if (result.kind === 'notFound') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (result.kind === 'closed' || result.kind === 'hasPayments') {
      return NextResponse.json(
        {
          error:
            'Items can only be added to a draft or unpaid invoice that has no payments recorded.',
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ item: result.item }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}