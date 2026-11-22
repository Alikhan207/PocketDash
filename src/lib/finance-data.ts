import {prisma} from '@/lib/db';
import {calculateForecast} from '@/lib/finance';
export async function financeData(userId:string){
 const shop=await prisma.shop.findUnique({where:{userId}});if(!shop)throw new Error('Shop not found');
 const [payments,expenses,invoices]=await Promise.all([
 prisma.payment.findMany({where:{invoice:{shopId:shop.id,status:{notIn:['draft','cancelled']}}}}),
 prisma.expens.findMany({where:{shopId:shop.id}}),
 prisma.invoice.findMany({where:{shopId:shop.id},include:{payments:true,customer:true}})]);
 return {shop,payments,expenses,invoices};
}
export async function forecastFor(userId:string,days=30,scenario?:{invoiceId:string;delayDays:number}){return calculateForecast(await financeData(userId),days,undefined,scenario);}
