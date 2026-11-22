// Pure cash calculations shared by dashboard, alerts and what-if comparisons.
export const dayKey=(value:Date|string)=>typeof value==='string'?value.slice(0,10):value.toISOString().slice(0,10);
export const todayKey=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const addDays=(day:string,n:number)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export const paise=(value:unknown)=>Math.round(Number(value??0)*100);
export const inr=(value:number|string)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(value));
type Amount=string|number|{toString():string};
type Payment={amount:Amount;paidOn:Date|string};
type Bill={id:string;description:string;amount:Amount;dueDate:Date|string;status:string;paidOn:Date|string|null;revisedPaymentDate:Date|string|null};
type Invoice={id:string;invoiceNumber:string;status:string;totalAmount:Amount;dueDate:Date|string;expectedCollectionDate:Date|string|null;customer:{name:string};payments:{amount:Amount}[]};
export type FinanceInput={shop:{openingCashBalance:Amount|null;openingBalanceEffectiveDate:Date|string|null};payments:Payment[];expenses:Bill[];invoices:Invoice[]};
export function calculateForecast(input:FinanceInput,days=30,today=todayKey(),scenario?:{invoiceId:string;delayDays:number}){
 const {shop,payments,expenses,invoices}=input;
 const cutoff=shop.openingBalanceEffectiveDate?dayKey(shop.openingBalanceEffectiveDate):today;
 const setupRequired=shop.openingCashBalance===null||!shop.openingBalanceEffectiveDate;
 const opening=paise(shop.openingCashBalance);
 // Opening balance is the balance at the START of effective_date. Earlier movements are already included.
 const actual=(date:Date|string)=>dayKey(date)>=cutoff&&dayKey(date)<=today;
 const receipts=payments.filter(p=>actual(p.paidOn)).reduce((sum,p)=>sum+paise(p.amount),0);
 const paidBills=expenses.filter(e=>e.status==='paid'&&e.paidOn&&actual(e.paidOn)).reduce((sum,e)=>sum+paise(e.amount),0);
 const current=opening+receipts-paidBills;
 const deltas=new Map<string,number>();const end=addDays(today,days);
 const breakdown:{label:string;amount:number;kind:string}[]=[{label:'Opening cash at start of '+cutoff,amount:opening/100,kind:'opening'},{label:'Actual receipts since opening date',amount:receipts/100,kind:'actual_receipt'},{label:'Actual bills paid since opening date',amount:paidBills/100,kind:'actual_payment'}];
 const add=(date:string,amount:number)=>deltas.set(date,(deltas.get(date)||0)+amount);
 let expected=0,bills=0,unscheduledTotal=0;
 const unscheduled:{invoiceId:string;invoiceNumber:string;customerName:string;outstandingBalance:number;dueDate:string;daysOverdue:number;expectedCollectionDate:null;lastFollowUpSentAt:null;isOverdue:boolean}[]=[];
 for(const invoice of invoices){
  if(!['unpaid','partially_paid'].includes(invoice.status))continue;
  const amount=paise(invoice.totalAmount)-invoice.payments.reduce((s,p)=>s+paise(p.amount),0);
  if(amount<=0)continue;
  let date=dayKey(invoice.expectedCollectionDate??invoice.dueDate);
  if(date<today){unscheduledTotal+=amount;unscheduled.push({invoiceId:invoice.id,invoiceNumber:invoice.invoiceNumber,customerName:invoice.customer.name,outstandingBalance:amount/100,dueDate:dayKey(invoice.dueDate),daysOverdue:Math.max(0,Math.round((Date.parse(today)-Date.parse(dayKey(invoice.dueDate)))/86400000)),expectedCollectionDate:null,lastFollowUpSentAt:null,isOverdue:dayKey(invoice.dueDate)<today});continue;}
  if(scenario?.invoiceId===invoice.id)date=addDays(date,scenario.delayDays);
  if(date>end)continue;
  add(date,amount);expected+=amount;breakdown.push({label:`${date} · ${invoice.invoiceNumber} · ${invoice.customer.name}`,amount:amount/100,kind:'expected_collection'});
 }
 for(const bill of expenses){
  if(bill.status==='paid')continue;
  const planned=dayKey(bill.revisedPaymentDate??bill.dueDate);const date=planned<today?today:planned;
  if(date>end)continue;
  const amount=paise(bill.amount);add(date,-amount);bills+=amount;
  breakdown.push({label:`${date} · ${bill.description}${planned<today?' (overdue; due today)':''}`,amount:amount/100,kind:'unpaid_bill'});
 }
 const chart:{date:string;balance:number}[]=[];
 let running=current,min=current,shortage=current<0?{date:today,amount:-current/100}:null;
 for(let n=0;n<=days;n++){const date=addDays(today,n);running+=deltas.get(date)||0;min=Math.min(min,running);chart.push({date,balance:running/100});if(running<0&&!shortage)shortage={date,amount:-running/100};}
 return {forecast_days:days,setup_required:setupRequired,opening_balance:opening/100,current_available_cash:current/100,expected_collections_total:expected/100,unscheduled_overdue_total:unscheduledTotal/100,unpaid_expenses_total:bills/100,projected_end_balance:running/100,min_cash:min/100,first_shortage:shortage,chart,breakdown,unscheduled,
 assumptions:[`Opening cash is the balance at the START of ${cutoff}. Transactions on that date are added once; earlier transactions are already included.`, 'Actual cash includes recorded receipts and paid bills through today only.','Draft and cancelled invoices are excluded. Only outstanding balances are forecast.','Collections with no future/current date are unscheduled until you enter a new expected date.','Overdue unpaid bills are outflows today unless rescheduled.','Daily balances net same-day movements; intraday timing is not modelled.'],
 note:setupRequired?'Set your opening balance and effective date in Settings before relying on these estimates.':'Expected collections are estimates based on entered records, not bank-verified. No unentered sales or expenses are predicted.'};
}
