import {todayKey} from '@/lib/finance';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

type RouteContext = { params: Promise<{ shopId: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ParseResult = { data: Prisma.ShopUpdateInput } | { error: string };

function optionalText(value: unknown, field: string, max: number): { value: string | null } | { error: string } {
  if (value === undefined) return { value: undefined as unknown as null };
  if (value === null) return { value: null };
  if (typeof value !== 'string') return { error: `${field} must be a string` };
  const trimmed = value.trim();
  if (trimmed.length > max) return { error: `${field} must be at most ${max} characters` };
  return { value: trimmed.length === 0 ? null : trimmed };
}

function parseShopPatch(body: unknown): ParseResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object' };
  }
  const input = body as Record<string, unknown>;
  const data: Prisma.ShopUpdateInput = {};

  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || input.name.trim().length === 0) {
      return { error: 'name must be a non-empty string' };
    }
    if (input.name.trim().length > 200) {
      return { error: 'name must be at most 200 characters' };
    }
    data.name = input.name.trim();
  }

  for (const field of ['phone', 'address'] as const) {
    if (input[field] !== undefined) {
      const result = optionalText(input[field], field, field === 'address' ? 1000 : 50);
      if ('error' in result) return { error: result.error };
      data[field] = result.value;
    }
  }

  if (input.email !== undefined) {
    if (input.email === null || (typeof input.email === 'string' && input.email.trim() === '')) {
      data.email = null;
    } else if (typeof input.email !== 'string') {
      return { error: 'email must be a string' };
    } else {
      const email = input.email.trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 254) {
        return { error: 'email must be a valid email address' };
      }
      data.email = email;
    }
  }

  if (input.openingCashBalance !== undefined) {
    if (input.openingCashBalance === null) {
      data.openingCashBalance = null;
    } else if (typeof input.openingCashBalance !== 'number' || !Number.isFinite(input.openingCashBalance)) {
      return { error: 'openingCashBalance must be a number or null' };
    } else {
      data.openingCashBalance = Math.round(input.openingCashBalance * 100) / 100;
    }
  }

  if (input.openingBalanceEffectiveDate !== undefined) {
    if (input.openingBalanceEffectiveDate === null) {
      data.openingBalanceEffectiveDate = null;
    } else if (
      typeof input.openingBalanceEffectiveDate !== 'string' ||
      !DATE_RE.test(input.openingBalanceEffectiveDate) ||
      Number.isNaN(new Date(input.openingBalanceEffectiveDate).getTime())
    ) {
      return { error: 'openingBalanceEffectiveDate must be a date in YYYY-MM-DD format or null' };
    } else {
      data.openingBalanceEffectiveDate = new Date(input.openingBalanceEffectiveDate);
    }
  }

  const hasAmount=input.openingCashBalance!==undefined,hasDate=input.openingBalanceEffectiveDate!==undefined;
  if(hasAmount!==hasDate)return {error:'Supply the opening balance and effective date together.'};
  if(hasAmount&&((input.openingCashBalance===null)!==(input.openingBalanceEffectiveDate===null)))return {error:'Both opening fields must be filled or both empty.'};
  if(typeof input.openingCashBalance==='number' && (Math.abs(input.openingCashBalance)>9999999999.99 || Math.abs(input.openingCashBalance*100-Math.round(input.openingCashBalance*100))>0.0001))return {error:'Opening cash must have at most two decimal places.'};
  if(typeof input.openingBalanceEffectiveDate==='string'&&(input.openingBalanceEffectiveDate>todayKey()||new Date(input.openingBalanceEffectiveDate).toISOString().slice(0,10)!==input.openingBalanceEffectiveDate))return {error:'Choose a valid opening date, today or earlier.'};
  return { data };
}

async function findOwnedShop(shopId: string, userId: string) {
  if (!UUID_RE.test(shopId)) return null;
  return prisma.shop.findFirst({ where: { id: shopId, userId } });
}

export async function GET(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { shopId } = await params;

  try {
    const shop = await findOwnedShop(shopId, user.id);
    if (!shop) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ shop });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { shopId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = parseShopPatch(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const existing = await findOwnedShop(shopId, user.id);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const shop = await prisma.shop.update({
      where: { id: existing.id },
      data: parsed.data,
    });

    return NextResponse.json({ shop });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}