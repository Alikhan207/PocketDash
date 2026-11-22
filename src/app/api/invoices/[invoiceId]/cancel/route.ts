import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { invoiceId } = await params;

  try {
    const shop = await prisma.shop.findUnique({ where: { userId: user.id } });
    if (!shop) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, shopId: shop.id },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (invoice.status !== 'draft' && invoice.status !== 'unpaid') {
      return NextResponse.json(
        { error: `Only draft or unpaid invoices can be cancelled (current status: ${invoice.status}).` },
        { status: 409 }
      );
    }

    const paymentCount = await prisma.payment.count({ where: { invoiceId: invoice.id } });
    if (paymentCount > 0) {
      return NextResponse.json(
        { error: 'This invoice has recorded payments and cannot be cancelled.' },
        { status: 409 }
      );
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'cancelled' },
    });

    return NextResponse.json({ invoice: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}