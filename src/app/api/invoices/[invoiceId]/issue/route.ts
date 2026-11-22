import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const MAX_INVOICE_NUMBER_LENGTH = 30;

function buildCandidateInvoiceNumber(): string {
  return `INV-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

async function nextUniqueInvoiceNumber(shopId: string, excludeInvoiceId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = buildCandidateInvoiceNumber();
    const clash = await prisma.invoice.findFirst({
      where: { shopId, invoiceNumber: candidate, id: { not: excludeInvoiceId } },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  throw new Error('Could not generate a unique invoice number');
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const invoiceId = (await params).invoiceId;

  try {
    const shop = await prisma.shop.findUnique({ where: { userId: user.id } });
    if (!shop) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, shopId: shop.id },
      include: { items: true },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft invoices can be issued.' },
        { status: 409 }
      );
    }

    if (invoice.items.length === 0) {
      return NextResponse.json(
        { error: 'Add at least one item before issuing this invoice.' },
        { status: 400 }
      );
    }

    const total = invoice.items.reduce(
      (sum, item) => sum + item.lineTotal.toNumber(),
      0
    );
    if (!(total > 0)) {
      return NextResponse.json(
        { error: 'Invoice total must be above zero before it can be issued.' },
        { status: 400 }
      );
    }

    if (invoice.dueDate.getTime() < invoice.issueDate.getTime()) {
      return NextResponse.json(
        { error: 'Due date cannot be before the issue date.' },
        { status: 400 }
      );
    }

    let invoiceNumber = invoice.invoiceNumber.trim();

    if (invoiceNumber.length > MAX_INVOICE_NUMBER_LENGTH) {
      return NextResponse.json(
        { error: 'Invoice number must be 30 characters or fewer.' },
        { status: 400 }
      );
    }

    if (!invoiceNumber) {
      invoiceNumber = await nextUniqueInvoiceNumber(shop.id, invoice.id);
    } else {
      const clash = await prisma.invoice.findFirst({
        where: { shopId: shop.id, invoiceNumber, id: { not: invoice.id } },
        select: { id: true },
      });
      if (clash) {
        return NextResponse.json(
          { error: 'This invoice number is already used. Enter a different number.' },
          { status: 409 }
        );
      }
    }

    const result = await prisma.invoice.updateMany({
      where: { id: invoice.id, shopId: shop.id, status: 'draft' },
      data: {
        status: 'unpaid',
        invoiceNumber,
        totalAmount: total,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Only draft invoices can be issued.' },
        { status: 409 }
      );
    }

    const issued = await prisma.invoice.findUnique({ where: { id: invoice.id } });

    return NextResponse.json({ invoice: issued });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}