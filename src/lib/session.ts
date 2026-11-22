import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth, currentUser, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
export const SESSION_COOKIE_NAME = 'pocketdash_demo';
export interface SessionUser { id: string; email: string; name?: string | null; role?: string | null; isDemo?: boolean; }
export const clerkConfigured = () => Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
function secret() {
 const value = process.env.AUTH_SECRET;
 if (!value || value.length < 32) throw new Error('Set AUTH_SECRET to at least 32 random characters.');
 return new TextEncoder().encode(value);
}
export async function getSessionUser(_request?: Request): Promise<SessionUser | null> {
 // A demo token can resolve ONLY a demo account, never a private seller.
 if (process.env.ENABLE_DEMO === 'true') {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (token) try {
   const {payload} = await jwtVerify(token, secret(), {algorithms:['HS256'], issuer:'pocketdash-demo', audience:'pocketdash'});
   const row = await prisma.user.findFirst({where:{id:String(payload.sub),isDemo:true,deletedAt:null}});
   if(row && row.tokenVersion === payload.tv) return {...row, role:'Seller'};
  } catch { /* Expired or invalid demo sessions do not grant access. */ }
 }
 if (!clerkConfigured()) {
  // Local development only: never hand out the shared demo account in production or with the demo disabled.
  if (process.env.ENABLE_DEMO !== 'true' || process.env.NODE_ENV === 'production') return null;
  const demo = await prisma.user.findFirst({where:{id:'00000000-0000-4000-8000-000000000001',isDemo:true,deletedAt:null,shop:{isNot:null}}});
  return demo ? {...demo, role:'Seller'} : null;
 }
 const identity = await auth();
 if(!identity.userId) return null;
 const existing = await prisma.user.findUnique({where:{clerkUserId:identity.userId}});
 if(existing) return existing.deletedAt || existing.isDemo ? null : {...existing,role:'Seller'};
 const remote = await currentUser();
 const email = remote?.primaryEmailAddress?.emailAddress;
 if(!remote || !email || remote.primaryEmailAddress?.verification?.status !== 'verified') return null;
 const row = await prisma.user.upsert({where:{clerkUserId:remote.id},update:{},create:{
  clerkUserId:remote.id,email:email.toLowerCase(),name:remote.fullName || 'Seller',
  shop:{create:{name:'My maker shop'}}
 }});
 return {...row,role:'Seller'};
}
export async function requireUser(request?: Request): Promise<SessionUser | NextResponse> {
 const origin=request?.headers.get('origin');
 if(request && !['GET','HEAD','OPTIONS'].includes(request.method) && origin && origin !== new URL(request.url).origin)
  return NextResponse.json({error:'Cross-origin writes are not permitted.'},{status:403});
 try { return await getSessionUser(request) ?? NextResponse.json({error:'Sign in to continue.'},{status:401}); }
 catch { return NextResponse.json({error:'Account service is unavailable. Please retry.'},{status:503}); }
}
export async function sessionResponse(body: Record<string,unknown>, user: SessionUser, init?: ResponseInit) {
 const row=await prisma.user.findFirst({where:{id:user.id,isDemo:true}});
 if(!row) throw new Error('Only demo accounts use local sessions.');
 const token=await new SignJWT({tv:row.tokenVersion}).setProtectedHeader({alg:'HS256'}).setSubject(row.id)
  .setIssuer('pocketdash-demo').setAudience('pocketdash').setIssuedAt().setExpirationTime('24h').sign(secret());
 const response=NextResponse.json(body,init);
 response.cookies.set(SESSION_COOKIE_NAME,token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:86400});
 return response;
}
export function clearSession(response:NextResponse) {
 response.cookies.set(SESSION_COOKIE_NAME,'',{httpOnly:true,sameSite:'lax',path:'/',maxAge:0}); return response;
}
export async function endSessions(id:string) {
 const row=await prisma.user.findUnique({where:{id}});
 if(row?.isDemo) await prisma.user.update({where:{id},data:{tokenVersion:{increment:1}}});
 else if(clerkConfigured()) { const {sessionId}=await auth(); if(sessionId) await (await clerkClient()).sessions.revokeSession(sessionId); }
}
