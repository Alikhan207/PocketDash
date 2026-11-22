import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const METHODS = ['cash', 'upi', 'bank_transfer', 'card', 'other'] as const;
const KINDS = ['advance', 'partial', 'final'] as const;

type PaymentMethodValue = (typeof METHODS)[number];
type PaymentKindValue = (typeof KINDS)[number];

class PaymentRejection extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function kolkataToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isValidCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function parseAmount(raw: unknown): Prisma.Decimal | null {
  if (raw === undefined || raw === null || raw === '') return null;
  try {
    const amount = new Prisma.Decimal(String(raw).trim());
    if (!amount.isFinite()) return null;
    if (amount.decimalPlaces() > 2) return null;
    return amount;
  } catch {
    return null;
  }
}

async function findOwnedInvoice(invoiceId: string, userId: string) {
  if (!UUID_RE.test(invoiceId)) return null;
  return prisma.invoice.findFirst({
    where: { id: invoiceId, shop: { userId } },
    select: { id: true, status: true, totalAmount: true },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const invoice = await findOwnedInvoice((await params).invoiceId, user.id);
    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const payments = await prisma.payment.findMany({
      where: { invoiceId: invoice.id },
      orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ payments });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const body = parsed as Record<string, unknown>;

  const amount = parseAmount(body.amount);
  if (!amount) {
    return NextResponse.json({ error: 'Enter the amount received.' }, { status: 400 });
  }
  if (amount.lte(0)) {
    return NextResponse.json(
      { error: 'Enter an amount between ₹1 and the outstanding balance.' },
      { status: 400 },
    );
  }

  const paidOnRaw = body.paidOn ?? body.paid_on;
  if (typeof paidOnRaw !== 'string' || paidOnRaw.trim() === '') {
    return NextResponse.json({ error: 'Select the date the payment was received.' }, { status: 400 });
  }
  const paidOn = paidOnRaw.trim();
  if (!isValidCalendarDate(paidOn)) {
    return NextResponse.json({ error: 'Enter a valid date that is today or earlier.' }, { status: 400 });
  }
  if (paidOn > kolkataToday()) {
    return NextResponse.json(
      { error: 'Enter the date the payment was received. It cannot be in the future.' },
      { status: 400 },
    );
  }

  const method = body.method;
  if (typeof method !== 'string' || !(METHODS as readonly string[]).includes(method)) {
    return NextResponse.json({ error: 'Choose how the payment was received.' }, { status: 400 });
  }
  const methodValue = method as PaymentMethodValue;

  const kind = body.kind;
  if (typeof kind !== 'string' || !(KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json(
      { error: 'Choose whether this is an advance, partial payment or final payment.' },
      { status: 400 },
    );
  }
  const kindValue = kind as PaymentKindValue;

  const keyRaw = body.idempotencyKey ?? body.idempotency_key;
  if (typeof keyRaw !== 'string' || keyRaw.trim() === '' || keyRaw.trim().length > 200) {
    return NextResponse.json(
      { error: 'Missing required fields: idempotency_key' },
      { status: 400 },
    );
  }
  const idempotencyKey = keyRaw.trim();

  try {
    const invoiceExists = await findOwnedInvoice((await params).invoiceId, user.id);
    if (!invoiceExists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const invoiceId = invoiceExists.id;

    const result = await prisma.$transaction(
      async (tx) => {
        const invoice = await tx.invoice.findFirst({
          where: { id: invoiceId, shop: { userId: user.id } },
          select: { id: true, status: true, totalAmount: true },
        });
        if (!invoice) {
          throw new PaymentRejection(404, 'Not found');
        }

        // Idempotent replay: return the payment recorded with this key.
        const existing = await tx.payment.findFirst({
          where: { invoiceId: invoice.id, idempotencyKey },
        });
        if (existing) {
          if (!existing.amount.equals(amount) || existing.paidOn.toISOString().slice(0,10)!==paidOn || existing.method!==methodValue || existing.kind!==kindValue)
            throw new PaymentRejection(409,'This payment key was already used for different details.');
          const agg = await tx.payment.aggregate({
            where: { invoiceId: invoice.id },
            _sum: { amount: true },
          });
          const paid = agg._sum.amount ?? new Prisma.Decimal(0);
          const outstanding = new Prisma.Decimal(invoice.totalAmount).minus(paid);
          return {
            payment: existing,
            outstanding,
            status: invoice.status,
            replay: true,
          };
        }

        if (invoice.status !== 'unpaid' && invoice.status !== 'partially_paid') {
          throw new PaymentRejection(
            409,
            'Payments can only be recorded on unpaid or partially paid invoices.',
          );
        }

        const agg = await tx.payment.aggregate({
          where: { invoiceId: invoice.id },
          _sum: { amount: true },
        });
        const paid = agg._sum.amount ?? new Prisma.Decimal(0);
        const total = new Prisma.Decimal(invoice.totalAmount);
        const currentOutstanding = total.minus(paid);

        if (currentOutstanding.lte(0)) {
          throw new PaymentRejection(
            409,
            'This invoice has no outstanding balance to pay.',
          );
        }

        if (amount.gt(currentOutstanding)) {
          throw new PaymentRejection(
            400,
            `Enter an amount between ₹1 and the outstanding balance of ₹${currentOutstanding.toFixed(2)}.`,
          );
        }

        const payment = await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: amount.toDecimalPlaces(2),
            paidOn: new Date(`${paidOn}T00:00:00.000Z`),
            method: methodValue,
            kind: kindValue,
            idempotencyKey,
          },
        });

        const newPaid = paid.plus(amount);
        const newOutstanding = total.minus(newPaid);
        const newStatus = newOutstanding.lte(0) ? 'paid' : 'partially_paid';

        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: newStatus },
        });

        return {
          payment,
          outstanding: newOutstanding,
          status: newStatus,
          replay: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json(
      {
        payment: result.payment,
        outstanding_balance: result.outstanding.toNumber(),
        status: result.status,
      },
      { status: result.replay ? 200 : 201 },
    );
  } catch (e) {
    if (e instanceof PaymentRejection) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      if (e.code === 'P2034' || e.code === 'P2002') {
        return NextResponse.json(
          { error: 'Another payment was recorded at the same time. Please try again.' },
          { status: 409 },
        );
      }
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}