
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ scenarioId: string }> },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { scenarioId } = await params;
  if (!UUID_RE.test(scenarioId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const owned = await prisma.scenario.findFirst({
      where: { id: scenarioId, shop: { userId: user.id } },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const scenario = await prisma.scenario.update({
      where: { id: scenarioId },
      data: { status: 'reset' },
    });

    return NextResponse.json({ scenario });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}