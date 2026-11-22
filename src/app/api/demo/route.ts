import {NextResponse} from 'next/server';import {createDemo} from '@/lib/demo';import {getSessionUser,sessionResponse} from '@/lib/session';import {prisma} from '@/lib/db';
const attempts=new Map<string,{count:number;until:number}>();
export async function POST(request:Request){
 if(process.env.ENABLE_DEMO!=='true')return NextResponse.json({error:'Demo is disabled.'},{status:404});
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return NextResponse.json({error:'Invalid origin'},{status:403});
 // X-Forwarded-For is client-controlled unless a trusted proxy sets it, so only use it when TRUST_PROXY=true.
 const trusted=process.env.TRUST_PROXY==='true';const key=trusted?(request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown'):'all';const limit=trusted?20:200;const now=Date.now();
 if(attempts.size>10000)for(const [k,v]of attempts)if(v.until<now)attempts.delete(k);
 const attempt=attempts.get(key);if(attempt&&attempt.until>now&&attempt.count>=limit)return NextResponse.json({error:'Please wait before creating another demo.'},{status:429});
 attempts.set(key,{count:attempt&&attempt.until>now?attempt.count+1:1,until:attempt&&attempt.until>now?attempt.until:now+3600000});
 try{if(!process.env.AUTH_SECRET||process.env.AUTH_SECRET.length<32)throw new Error('Demo configuration missing');const existing=await getSessionUser();if(existing?.isDemo)return NextResponse.json({ok:true});
  // Demo sessions last 24h, so workspaces older than that are unreachable: remove them to keep the database bounded.
  await prisma.user.deleteMany({where:{isDemo:true,clerkUserId:{startsWith:'demo_'},createdAt:{lt:new Date(now-86400000)}}}).catch(e=>console.error('Demo cleanup failed:',e instanceof Error?e.message:'unknown'));
  const user=await createDemo();return sessionResponse({ok:true},user);}catch(e){console.error('Demo setup failed:',e instanceof Error?e.message:'unknown');return NextResponse.json({error:'Demo could not start. Check the database migration and AUTH_SECRET configuration.'},{status:503});}}
