import {NextResponse} from 'next/server';import {Prisma} from '@prisma/client';import {requireUser} from '@/lib/session';import {prisma} from '@/lib/db';import {financeData} from '@/lib/finance-data';import {calculateForecast,todayKey,dayKey,addDays,paise,inr} from '@/lib/finance';
export async function GET(request:Request){const u=await requireUser(request);if(u instanceof Response)return u;
 try{const data=await financeData(u.id);const forecast=calculateForecast(data,90);const today=todayKey();const wanted:Prisma.AlertUncheckedCreateInput[]=[];
 const owed=(x:typeof data.invoices[number])=>paise(x.totalAmount)-x.payments.reduce((s,p)=>s+paise(p.amount),0);
 for(const i of [...data.invoices].sort((x,y)=>owed(y)-owed(x))){if(!['unpaid','partially_paid'].includes(i.status))continue;const balance=paise(i.totalAmount)-i.payments.reduce((s,p)=>s+paise(p.amount),0);if(balance<=0)continue;
 const late=Math.round((Date.parse(today)-Date.parse(dayKey(i.dueDate)))/86400000);const unscheduled=dayKey(i.expectedCollectionDate??i.dueDate)<today;
 if(dayKey(i.dueDate)<today)wanted.push({shopId:data.shop.id,invoiceId:i.id,alertType:'overdue_invoice',message:`Chase ${i.customer.name} today: ${inr(balance/100)} on ${i.invoiceNumber}, ${late} ${late===1?'day':'days'} late (due ${dayKey(i.dueDate)}).${unscheduled?' Then set a new expected date so it counts in your forecast.':''}`});
 else if(unscheduled)wanted.push({shopId:data.shop.id,invoiceId:i.id,alertType:'overdue_no_expected_date',message:`Set a new expected collection date for ${i.invoiceNumber}; ${inr(balance/100)} is excluded from the dated forecast.`});}
 for(const e of data.expenses)if(e.status==='unpaid'&&dayKey(e.revisedPaymentDate??e.dueDate)<=addDays(today,7))wanted.push({shopId:data.shop.id,expenseId:e.id,alertType:'upcoming_bill',message:`${e.description}: ${inr(Number(e.amount))}, ${dayKey(e.dueDate)<today?'overdue since':'due'} ${dayKey(e.dueDate)}. Review this bill.`});
 if(forecast.first_shortage&&!forecast.setup_required)wanted.push({shopId:data.shop.id,alertType:'cash_shortage',message:`Projected shortfall of ${inr(forecast.first_shortage.amount)} on ${forecast.first_shortage.date}. Review collections and bills.`,shortageDate:new Date(forecast.first_shortage.date),shortageAmount:forecast.first_shortage.amount});
 const alerts=await prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM shops WHERE id = ${data.shop.id}::uuid FOR UPDATE`;
 const old=await tx.alert.findMany({where:{shopId:data.shop.id}});const active=[];
 for(const item of wanted){const match=old.find(a=>a.alertType===item.alertType&&a.invoiceId===(item.invoiceId??null)&&a.expenseId===(item.expenseId??null));active.push(match?await tx.alert.update({where:{id:match.id},data:{...item,status:'active',resolvedAt:null}}):await tx.alert.create({data:item}));}
 await tx.alert.updateMany({where:{shopId:data.shop.id,status:'active',id:{notIn:active.map(a=>a.id)}},data:{status:'resolved',resolvedAt:new Date()}});return active;});
 return NextResponse.json({alerts});}catch{return NextResponse.json({error:'Could not refresh alerts.'},{status:500});}}
