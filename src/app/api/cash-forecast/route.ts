import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/session';
import {forecastFor} from '@/lib/finance-data';
export async function GET(request:Request){const user=await requireUser(request);if(user instanceof Response)return user;
 const days=Number(new URL(request.url).searchParams.get('forecast_days')??30);
 if(![30,60,90].includes(days))return NextResponse.json({error:'Choose 30, 60 or 90 days.'},{status:400});
 try{return NextResponse.json({forecast:await forecastFor(user.id,days)});}catch{return NextResponse.json({error:'Could not load the cash forecast.'},{status:500});}}
