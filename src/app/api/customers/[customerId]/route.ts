import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

type RouteContext = {
  params: Promise<{ customerId: string }> | { customerId: string };
};

type CustomerPatch = {
  name?: string;
  phone?: string | null;
  email?: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getCustomerId(context: RouteContext): Promise<string> {
  const { customerId } = await context.params;
  return customerId;
}

async function findOwnedCustomer(customerId: string, userId: string) {
  if (!UUID_RE.test(customerId)) return null;
  return prisma.customer.findFirst({
    where: { id: customerId, shop: { userId } },
  });
}

function handleError(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (e.code === 'P2003') {
      return NextResponse.json(
        { error: 'Customer has invoices and cannot be deleted.' },
        { status: 409 },
      );
    }
  }
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}

function validateCustomerPatch(
  body: Record<string, unknown>,
): { data: CustomerPatch } | { error: string } {
  const data: CustomerPatch = {};

  if ('name' in body) {
    if (typeof body.name !== 'string') {
      return { error: "Enter the customer's name." };
    }
    const name = body.name.trim();
    if (!name) {
      return { error: "Enter the customer's name." };
    }
    if (name.length > 100) {
      return { error: 'Customer name must be 100 characters or fewer.' };
    }
    data.name = name;
  }

  if ('phone' in body) {
    const raw = body.phone;
    if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
      data.phone = null;
    } else if (typeof raw !== 'string') {
      return {
        error:
          'Enter a valid 10-digit Indian mobile number, for example 98765 43210, or leave it blank.',
      };
    } else {
      const match = raw.replace(/[\s-]/g, '').match(/^(?:\+91|0)?(\d{10})$/);
      if (!match || !/^[6-9]/.test(match[1])) {
        return {
          error:
            'Enter a valid 10-digit Indian mobile number, for example 98765 43210, or leave it blank.',
        };
      }
      data.phone = match[1];
    }
  }

  if ('email' in body) {
    const raw = body.email;
    if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
      data.email = null;
    } else if (typeof raw !== 'string') {
      return {
        error: 'Enter a valid email address, such as name@example.com, or leave it blank.',
      };
    } else {
      const email = raw.trim();
      if (email.length > 254 || !EMAIL_RE.test(email)) {
        return {
          error: 'Enter a valid email address, such as name@example.com, or leave it blank.',
        };
      }
      data.email = email;
    }
  }

  return { data };
}

export async function GET(request: Request, context: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const customerId = await getCustomerId(context);
    const customer = await findOwnedCustomer(customerId, user.id);
    if (!customer) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const invoices = await prisma.invoice.findMany({
      where: { customerId: customer.id },
      orderBy: { issueDate: 'desc' },
    });

    const payments = await prisma.payment.findMany({
      where: { invoice: { customerId: customer.id } },
      orderBy: { paidOn: 'desc' },
    });

    const paidByInvoice = new Map<string, Prisma.Decimal>();
    for (const payment of payments) {
      const current = paidByInvoice.get(payment.invoiceId) ?? new Prisma.Decimal(0);
      paidByInvoice.set(payment.invoiceId, current.plus(payment.amount));
    }

    let outstanding = new Prisma.Decimal(0);
    for (const invoice of invoices) {
      if (
        invoice.status !== 'unpaid' &&
        invoice.status !== 'partially_paid' &&
        invoice.status !== 'paid'
      ) {
        continue;
      }
      const paid = paidByInvoice.get(invoice.id) ?? new Prisma.Decimal(0);
      const remaining = invoice.totalAmount.minus(paid);
      if (remaining.greaterThan(0)) {
        outstanding = outstanding.plus(remaining);
      }
    }

    return NextResponse.json({
      customer,
      outstanding_balance: outstanding.toNumber(),
      invoices,
      payments,
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const validation = validateCustomerPatch(body as Record<string, unknown>);
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const customerId = await getCustomerId(context);
    const existing = await findOwnedCustomer(customerId, user.id);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const customer =
      Object.keys(validation.data).length === 0
        ? existing
        : await prisma.customer.update({
            where: { id: existing.id },
            data: validation.data,
          });

    return NextResponse.json({ customer });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const customerId = await getCustomerId(context);
    const customer = await findOwnedCustomer(customerId, user.id);
    if (!customer) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const invoiceCount = await prisma.invoice.count({
      where: { customerId: customer.id },
    });
    if (invoiceCount > 0) {
      return NextResponse.json(
        { error: 'Customer has invoices and cannot be deleted.' },
        { status: 409 },
      );
    }

    await prisma.customer.delete({ where: { id: customer.id } });

    return NextResponse.json({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}