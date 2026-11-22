"use client";
import {useEffect,useState,useCallback} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import CashForecastChart from '@/components/CashForecastChart';
import ForecastBreakdownTable from '@/components/ForecastBreakdownTable';
import CollectionsTable from '@/components/CollectionsTable';
import {getCashForecast,getInvoices,updateInvoice} from '@/lib/api';
import {inr,dayKey,todayKey,type calculateForecast} from '@/lib/finance';
type Forecast=ReturnType<typeof calculateForecast>;
export default function CashForecastPage(){
 const[days,setDays]=useState(30);const[data,setData]=useState<Forecast|null>(null);const[scenario,setScenario]=useState<Forecast|null>(null);
 const[invoices,setInvoices]=useState<Awaited<ReturnType<typeof getInvoices>>>([]);const[id,setId]=useState('');const[delay,setDelay]=useState(15);const[error,setError]=useState('');const[busy,setBusy]=useState(false);const[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{setLoading(true);setError('');try{const[f,list]=await Promise.all([getCashForecast({forecast_days:days}),getInvoices()]);setData(f as Forecast);setInvoices(list);setScenario(null);}catch(e){setError(e instanceof Error?e.message:'Could not load forecast.');}finally{setLoading(false);}},[days]);
 useEffect(()=>{void load()},[load]);
 async function run(){setBusy(true);setError('');try{const r=await fetch('/api/scenarios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invoiceId:id,delayDays:delay,forecastDays:days,preview:true})});const b=await r.json();if(!r.ok)throw new Error(b.error);setData(b.baseline);setScenario(b.scenario_result);}catch(e){setError(e instanceof Error?e.message:'Scenario failed.');}finally{setBusy(false);}}
 const eligible=invoices.filter(i=>['unpaid','partially_paid'].includes(i.status)&&dayKey(i.expectedCollectionDate??i.dueDate)>=todayKey());
 return <main className="mx-auto max-w-6xl p-4 sm:p-8 space-y-6"><PageHeader title="See your next move." description="A clear view of cash over the next 30–90 days." actions={<div className="flex gap-2">{[30,60,90].map(n=><button key={n} aria-pressed={days===n} className={`rounded-full border px-4 py-2 ${days===n?'bg-primary text-primary-foreground':''}`} onClick={()=>{setScenario(null);setDays(n)}}>{n} days</button>)}</div>} className=""/>
 {error&&<p role="alert" className="text-destructive">{error} <button onClick={()=>void load()} className="underline">Retry</button></p>}
 {loading&&<p role="status">Loading your forecast…</p>}
 {data&&!loading&&<>
 {data.setup_required&&<p className="rounded-xl border border-accent p-4">{data.note} <Link href="/settings" className="underline">Set opening cash</Link></p>}
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Available cash',data.current_available_cash],['Expected collections',data.expected_collections_total],['Bills in this period',data.unpaid_expenses_total],['Projected closing cash',data.projected_end_balance]].map(([label,value])=><section key={String(label)} className="rounded-2xl border bg-card p-5"><p className="text-muted-foreground text-sm">{label}</p><p className="text-2xl font-bold mt-2 tabular-nums">{inr(Number(value))}</p></section>)}</div>
 <section className="rounded-2xl border bg-card p-6 space-y-4"><h2 className="text-xl font-semibold">What if a customer pays late?</h2><p className="text-muted-foreground">Delay one collection to see how your buffer changes. This does not edit any invoice or payment.</p><div className="flex flex-col sm:flex-row gap-3 sm:items-end"><label className="flex-1 space-y-2">Invoice<select aria-label="Scenario invoice" value={id} onChange={e=>{setId(e.target.value);setScenario(null)}} className="w-full rounded-xl border bg-background p-3"><option value="">Choose an outstanding invoice</option>{eligible.map(i=><option key={i.id} value={i.id}>{i.invoiceNumber} · {i.customer_name} · {inr(i.outstanding_balance)}</option>)}</select></label><label className="space-y-2">Delay (days)<input aria-label="Delay days" className="block rounded-xl border bg-background p-3 w-full sm:w-28" type="number" min={0} max={90} value={delay} onChange={e=>{setDelay(Number(e.target.value));setScenario(null)}}/></label><button disabled={!id||busy} className="rounded-full bg-primary text-primary-foreground px-6 py-3 disabled:opacity-50" onClick={run}>{busy?'Calculating…':'Run scenario'}</button><button className="rounded-full border px-6 py-3" onClick={()=>setScenario(null)}>Reset scenario</button></div>
 {!eligible.length&&<p>Set an expected date on an unscheduled invoice below to include it.</p>}
 {scenario&&<div className="grid gap-4 sm:grid-cols-2" aria-live="polite"><div className="rounded-xl bg-primary/10 p-4"><h3 className="font-semibold">Baseline</h3><p>Minimum cash: {inr(data.min_cash)}</p><p>{data.first_shortage?`First shortage: ${data.first_shortage.date} · ${inr(data.first_shortage.amount)}`:'No shortage in this period'}</p></div><div className="rounded-xl bg-accent/10 p-4"><h3 className="font-semibold">With {delay}-day delay</h3><p>Minimum cash: {inr(scenario.min_cash)}</p><p>{scenario.first_shortage?`First shortage: ${scenario.first_shortage.date} · ${inr(scenario.first_shortage.amount)}`:'No shortage in this period'}</p><p>Change in minimum cash: {inr(scenario.min_cash-data.min_cash)}</p></div></div>}
 </section>
 {data.first_shortage&&<p className="text-destructive">Baseline shortage: {inr(data.first_shortage.amount)} on {data.first_shortage.date}. <Link href="/collections" className="underline">Review collections</Link> or <Link href="/expenses" className="underline">review bills</Link>.</p>}
 <CashForecastChart series={data.chart} scenarioSeries={scenario?.chart} forecastDays={days} shortageDate={data.first_shortage?.date}/>
 <section className="space-y-3"><h2 className="text-xl font-semibold">Unscheduled collections · {inr(data.unscheduled_overdue_total)}</h2><p className="text-muted-foreground">Missing or missed expected dates stay outside the dated forecast. Set a new expected collection date.</p><div className="overflow-x-auto"><CollectionsTable rows={data.unscheduled} onSetExpectedDate={async(invoiceId,date)=>{await updateInvoice(invoiceId,{expectedCollectionDate:date});await load();}}/></div></section>
 <ForecastBreakdownTable rows={data.breakdown} note={data.note}/><details className="rounded-2xl border p-5"><summary className="font-semibold cursor-pointer">Forecast assumptions</summary><ul className="mt-3 space-y-2 list-disc pl-5">{data.assumptions.map(s=><li key={s}>{s}</li>)}</ul></details>
 </>}
 </main>;
}
