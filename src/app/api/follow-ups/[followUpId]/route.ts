import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ followUpId: string }> }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });
  }

  const { body } = input as { body?: unknown };
  if (body !== undefined && (typeof body !== 'string' || body.trim().length === 0)) {
    return NextResponse.json({ error: 'body must be a non-empty string' }, { status: 400 });
  }

  try {
    const followUp = await prisma.followUp.findFirst({
      where: {
        id: (await params).followUpId,
        invoice: { shop: { userId: user.id } },
      },
    });

    if (!followUp) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (followUp.status === 'sent') {
      return NextResponse.json(
        { error: 'Sent follow-ups cannot be edited' },
        { status: 409 }
      );
    }

    const updated = await prisma.followUp.update({
      where: { id: followUp.id },
      data: {
        ...(typeof body === 'string' ? { body: body.trim() } : {}),
      },
    });

    return NextResponse.json({ followUp: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ followUpId: string }> }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const followUp = await prisma.followUp.findFirst({
      where: {
        id: (await params).followUpId,
        invoice: { shop: { userId: user.id } },
      },
    });

    if (!followUp) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (followUp.status === 'sent') {
      return NextResponse.json(
        { error: 'Sent follow-ups cannot be deleted' },
        { status: 409 }
      );
    }

    await prisma.followUp.delete({
      where: { id: followUp.id },
    });

    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}