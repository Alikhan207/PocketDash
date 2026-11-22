import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import type { FollowUpChannel } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const CHANNELS: FollowUpChannel[] = ['whatsapp', 'copied', 'other'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isChannel(value: unknown): value is FollowUpChannel {
  return typeof value === 'string' && (CHANNELS as string[]).includes(value);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ followUpId: string }> }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const input = (typeof body === 'object' && body !== null ? body : {}) as {
    channel?: unknown;
    sent_at?: unknown;
  };

  if (!isChannel(input.channel)) {
    return NextResponse.json(
      { error: `channel must be one of: ${CHANNELS.join(', ')}` },
      { status: 400 }
    );
  }
  const channel: FollowUpChannel = input.channel;

  let sentAt: Date;
  if (input.sent_at === undefined || input.sent_at === null) {
    sentAt = new Date();
  } else {
    if (typeof input.sent_at !== 'string') {
      return NextResponse.json({ error: 'sent_at must be an ISO date string' }, { status: 400 });
    }
    const parsed = new Date(input.sent_at);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'sent_at must be a valid date' }, { status: 400 });
    }
    sentAt = parsed;
  }

  const followUpId = (await params).followUpId;
  if (!UUID_RE.test(followUpId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    // Ownership is enforced through invoice -> shop -> user.
    const existing = await prisma.followUp.findFirst({
      where: {
        id: followUpId,
        invoice: { shop: { userId: user.id } },
      },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft follow-ups can be marked sent' },
        { status: 409 }
      );
    }

    // Guarded update: only transitions a row that is still a draft.
    const result = await prisma.followUp.updateMany({
      where: { id: followUpId, status: 'draft' },
      data: {
        status: 'sent',
        channel,
        sentAt,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Only draft follow-ups can be marked sent' },
        { status: 409 }
      );
    }

    const followUp = await prisma.followUp.findUnique({
      where: { id: followUpId },
    });

    if (!followUp) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ followUp });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}