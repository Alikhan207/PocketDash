import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/session';import {prisma} from '@/lib/db';import {financeData} from '@/lib/finance-data';import {calculateForecast,dayKey,todayKey,addDays} from '@/lib/finance';
export async function GET(request:Request){const u=await requireUser(request);if(u instanceof Response)return u;const status=new URL(request.url).searchParams.get('status');return NextResponse.json({scenarios:await prisma.scenario.findMany({where:{shop:{userId:u.id},...(status==='active'||status==='reset'?{status}:{})},orderBy:{createdAt:'desc'}})});}
export async function POST(request:Request){const u=await requireUser(request);if(u instanceof Response)return u;
 try{const b=await request.json();const invoiceId=b.invoiceId??b.invoice_id;const delayDays=Number(b.delayDays??b.delay_days??15);const days=Number(b.forecastDays??b.forecast_days??30);
 if(!Number.isInteger(delayDays)||delayDays<0||delayDays>90||![30,60,90].includes(days))return NextResponse.json({error:'Choose a delay of 0–90 days and a forecast of 30, 60 or 90 days.'},{status:400});
 const data=await financeData(u.id);const invoice=data.invoices.find(i=>i.id===invoiceId&&['unpaid','partially_paid'].includes(i.status));
 if(!invoice)return NextResponse.json({error:'Select an outstanding invoice.'},{status:404});
 if(dayKey(invoice.expectedCollectionDate??invoice.dueDate)<todayKey())return NextResponse.json({error:'Set a current or future expected collection date first.'},{status:400});
 const baseline=calculateForecast(data,days);const result=calculateForecast(data,days,undefined,{invoiceId,delayDays});
 if(b.preview===true)return NextResponse.json({baseline,scenario_result:result,min_cash_change:result.min_cash-baseline.min_cash});
 const scenario=await prisma.$transaction(async tx=>{await tx.scenario.updateMany({where:{shopId:data.shop.id,status:'active'},data:{status:'reset'}});return tx.scenario.create({data:{shopId:data.shop.id,invoiceId,delayDays,forecastDays:days,status:'active',scenarioExpectedCollectionDate:new Date(addDays(dayKey(invoice.expectedCollectionDate??invoice.dueDate),delayDays)),baselineMinCash:baseline.min_cash,scenarioMinCash:result.min_cash}});});
 return NextResponse.json({scenario},{status:201});
 }catch{return NextResponse.json({error:'Could not calculate scenario. Check your inputs and retry.'},{status:400});}}
