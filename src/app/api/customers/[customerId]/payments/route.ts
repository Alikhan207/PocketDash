import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const shop = await prisma.shop.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!shop) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const customer = await prisma.customer.findFirst({
      where: { id: (await params).customerId, shopId: shop.id },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const rows = await prisma.payment.findMany({
      where: {
        invoice: {
          customerId: customer.id,
          shopId: shop.id,
        },
      },
      orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }],
    });

    const payments = rows.map((p) => ({
      id: p.id,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      invoiceId: p.invoiceId,
      amount: Number(p.amount),
      paidOn: p.paidOn.toISOString(),
      method: p.method,
      kind: p.kind,
      verificationStatus: p.verificationStatus,
      idempotencyKey: p.idempotencyKey,
    }));

    return NextResponse.json({ payments });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}