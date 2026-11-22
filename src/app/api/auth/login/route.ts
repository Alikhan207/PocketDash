import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/session';
export async function POST(request:Request){const user=await requireUser(request);if(user instanceof Response)return user;return NextResponse.json({user:{id:user.id,name:user.name,email:user.email,role:'Seller'}});}
