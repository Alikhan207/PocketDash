import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const userSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  email: true,
  name: true,
  clerkUserId: true,
  isDemo: true,
  lastSignedInAt: true,
  lastSignedOutAt: true,
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  const sessionUser = await requireUser(request);
  if (sessionUser instanceof Response) return sessionUser;

  try {
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: userSelect,
    });
    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const shop = await prisma.shop.findUnique({
      where: { userId: sessionUser.id },
      select: { id: true },
    });

    return NextResponse.json({
      user: {...user, role: 'Seller'},
      shop_id: shop?.id ?? null,
      is_demo: user.isDemo,
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH() { return NextResponse.json({error:'Manage your profile through Clerk.'},{status:405}); }
