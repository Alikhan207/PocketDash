import {prisma} from '@/lib/db';import {todayKey,addDays} from '@/lib/finance';import {randomUUID} from 'node:crypto';
export async function createDemo(){
 const today=todayKey();const date=(n:number)=>new Date(addDays(today,n));const key=randomUUID();
 return prisma.$transaction(async tx=>{
 const user=await tx.user.create({data:{clerkUserId:'demo_'+key,email:key+'@example.invalid',name:'Aanya · Demo',isDemo:true,shop:{create:{name:'Thread & Bloom',phone:'',address:'Fictional student maker business',openingCashBalance:8000,openingBalanceEffectiveDate:date(-14)}}},include:{shop:true}});
 const shopId=user.shop!.id;const customers=[];
 for(const name of ['Campus Art Club','Mira (sample)','Rhea (sample)','Design Society','Anika (sample)','College Fest Team'])customers.push(await tx.customer.create({data:{shopId,name}}));
 await tx.savedItem.createMany({data:[{shopId,description:'Custom printed T-shirt',unitPrice:600},{shopId,description:'Crochet flower bouquet',unitPrice:800},{shopId,description:'Delivery',unitPrice:80}]});
 for(let n=0;n<6;n++){const amount=n===0?6000:600+n*200;await tx.invoice.create({data:{shopId,customerId:customers[n].id,invoiceNumber:`TB-${1001+n}`,status:'unpaid',issueDate:date(-10),dueDate:date(n===0?3:-n),totalAmount:amount,items:{create:{description:n===0?'Custom printed T-shirts':'Crochet gift order',quantity:n===0?10:1,unitPrice:n===0?600:amount,lineTotal:amount}}}});}
 await tx.expens.createMany({data:[{shopId,description:'Printer and blank T-shirt batch',category:'printing',amount:10000,dueDate:date(5)},{shopId,description:'Yarn and packaging restock',category:'yarn',amount:500,dueDate:date(22)}]});
 return user;
 });
}
