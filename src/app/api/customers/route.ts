
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const NAME_REQUIRED = "Enter the customer's name.";
const NAME_TOO_LONG = 'Customer name must be 100 characters or fewer.';
const PHONE_INVALID =
  'Enter a valid 10-digit Indian mobile number, for example 98765 43210, or leave it blank.';
const EMAIL_INVALID =
  'Enter a valid email address, such as name@example.com, or leave it blank.';
const SEARCH_TOO_LONG =
  'Search is limited to 100 characters. Shorten your search to continue.';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[6-9]\d{9}$/;

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const shop = await prisma.shop.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    if (q.length > 100) {
      return NextResponse.json({ error: SEARCH_TOO_LONG }, { status: 400 });
    }

    const customers = await prisma.customer.findMany({
      where: {
        shopId: shop.id,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        invoices: {
          where: { status: { notIn: ['draft', 'cancelled'] } },
          select: {
            totalAmount: true,
            payments: { select: { amount: true } },
          },
        },
      },
    });

    const rows = customers.map(({ invoices, ...customer }) => {
      const outstanding = invoices.reduce((sum, invoice) => {
        const paid = invoice.payments.reduce(
          (acc, payment) => acc + payment.amount.toNumber(),
          0,
        );
        return sum + (invoice.totalAmount.toNumber() - paid);
      }, 0);
      return {
        ...customer,
        outstanding_balance: Math.round(outstanding * 100) / 100,
      };
    });

    return NextResponse.json({ customers: rows });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return NextResponse.json(
      { error: 'Request body must be an object' },
      { status: 400 },
    );
  }
  const body = raw as Record<string, unknown>;

  // Name: required, trimmed, max 100 characters.
  if (typeof body.name !== 'string' || body.name.trim() === '') {
    return NextResponse.json({ error: NAME_REQUIRED }, { status: 400 });
  }
  const name = body.name.trim();
  if (name.length > 100) {
    return NextResponse.json({ error: NAME_TOO_LONG }, { status: 400 });
  }

  // Phone: optional; 10-digit Indian mobile, optional +91 or 0 prefix,
  // spaces and hyphens ignored. Stored as the bare 10 digits.
  let phone: string | null = null;
  if (typeof body.phone === 'string' && body.phone.trim() !== '') {
    let digits = body.phone.replace(/[\s-]/g, '');
    if (digits.startsWith('+91')) {
      digits = digits.slice(3);
    } else if (digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    if (!PHONE_PATTERN.test(digits)) {
      return NextResponse.json({ error: PHONE_INVALID }, { status: 400 });
    }
    phone = digits;
  } else if (body.phone !== undefined && body.phone !== null && typeof body.phone !== 'string') {
    return NextResponse.json({ error: PHONE_INVALID }, { status: 400 });
  }

  // Email: optional; standard format, no spaces, up to 254 characters.
  let email: string | null = null;
  if (typeof body.email === 'string' && body.email.trim() !== '') {
    const trimmed = body.email.trim();
    if (trimmed.length > 254 || !EMAIL_PATTERN.test(trimmed) || /\s/.test(trimmed)) {
      return NextResponse.json({ error: EMAIL_INVALID }, { status: 400 });
    }
    email = trimmed;
  } else if (body.email !== undefined && body.email !== null && typeof body.email !== 'string') {
    return NextResponse.json({ error: EMAIL_INVALID }, { status: 400 });
  }

  try {
    const shop = await prisma.shop.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const customer = await prisma.customer.create({
      data: {
        shopId: shop.id,
        name,
        phone,
        email,
      },
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}