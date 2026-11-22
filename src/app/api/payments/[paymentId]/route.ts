import {NextResponse} from 'next/server';import {requireUser} from '@/lib/session';
export async function DELETE(request:Request){const u=await requireUser(request);if(u instanceof Response)return u;return NextResponse.json({error:'Recorded payments are immutable in this version. Verify the amount and date before recording.'},{status:405});}
