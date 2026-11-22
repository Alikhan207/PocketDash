import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ alertId: string }> }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const alertId = (await params).alertId;

  try {
    const shop = await prisma.shop.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!shop) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const existing = await prisma.alert.findFirst({
      where: { id: alertId, shopId: shop.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const alert = await prisma.alert.update({
      where: { id: existing.id },
      data: { actionTakenAt: new Date() },
    });

    return NextResponse.json({ alert });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}