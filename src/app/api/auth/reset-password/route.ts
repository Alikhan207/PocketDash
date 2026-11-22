import {NextResponse} from 'next/server';
export async function POST(){return NextResponse.json({error:'Use the Clerk account form to manage your password.'},{status:410});}
