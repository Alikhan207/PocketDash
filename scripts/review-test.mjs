import EmbeddedPostgres from 'embedded-postgres';
import {appendFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {request as requests} from '@playwright/test';
const env={...process.env,DATABASE_URL:'postgresql://postgres:pocketdash-local-test@127.0.0.1:55433/pocketdash',ENABLE_DEMO:'true',AUTH_SECRET:'local-review-only-demo-signing-key-32-chars',NEXT_TELEMETRY_DISABLED:'1'};
const dir='/tmp/pocketdash-e2e-'+Date.now();
const pg=new EmbeddedPostgres({databaseDir:dir,user:'postgres',password:'pocketdash-local-test',port:55433,persistent:false,autoRehydrateSymlinks:true,onLog:()=>{},onError:console.error});
const checks=[];let server;
const check=(name)=>{checks.push(name);console.log('PASS',name)};
function run(cmd,args){return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{env,stdio:'inherit'});p.on('exit',code=>code===0?resolve():reject(new Error(cmd+' exited '+code)));});}
try{
 await pg.initialise();appendFileSync(dir+'/postgresql.conf',"\nunix_socket_directories = ''\n");await pg.start();await pg.createDatabase('pocketdash');
 await run('node',['node_modules/prisma/build/index.js','migrate','deploy']);check('fresh PostgreSQL migration including constraints');
 const output=[];server=spawn('node',['node_modules/next/dist/bin/next',process.env.REVIEW_PRODUCTION?'start':'dev','-p','3100','-H','127.0.0.1'],{env,stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',b=>{output.push(String(b));appendFileSync('/tmp/pocketdash-server.log',String(b));});server.stderr.on('data',b=>{output.push(String(b));appendFileSync('/tmp/pocketdash-server.log',String(b));});
 const base='http://127.0.0.1:3100';let ready=false;
 for(let n=0;n<30;n++){try{const r=await fetch(base+'/login',{signal:AbortSignal.timeout(3000)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}
 if(!ready)throw new Error('Server failed: '+output.join('').slice(-8000));
 const a=await requests.newContext({baseURL:base});const b=await requests.newContext({baseURL:base});
 const json=async(ctx,path,method='GET',data,status=200)=>{const r=await ctx.fetch(path,{method,data});const body=await r.json();assert.equal(r.status(),status,`${method} ${path}: ${JSON.stringify(body)}`);return body;};
 await json(a,'/api/invoices','GET',undefined,401);check('signed-out records protected');
 await json(a,'/api/demo','POST');await json(b,'/api/demo','POST');
 const me=await json(a,'/api/auth/me');const other=await json(b,'/api/auth/me');assert.notEqual(me.shop_id,other.shop_id);check('demo sessions have distinct owners and shops');
 const invoices=(await json(a,'/api/invoices')).invoices;assert.equal(invoices.length,6);const keyInvoice=invoices.find(i=>i.invoiceNumber==='TB-1001');const otherInvoice=(await json(b,'/api/invoices')).invoices[0];
 await json(a,'/api/invoices/'+otherInvoice.id,'GET',undefined,404);await json(a,'/api/shops/'+other.shop_id,'PATCH',{name:'Intrusion'},404);check('cross-seller read and write rejected');
 const baseline=(await json(a,'/api/cash-forecast')).forecast;assert.equal(baseline.current_available_cash,8000);assert.equal(baseline.unscheduled.length,5);assert.equal(baseline.projected_end_balance,3500);
 const scenario=await json(a,'/api/scenarios','POST',{invoiceId:keyInvoice.id,delayDays:15,forecastDays:30,preview:true});assert.equal(scenario.scenario_result.min_cash,-2000);assert.equal(scenario.baseline.min_cash,3500);assert.equal((await json(a,'/api/invoices/'+keyInvoice.id)).invoice.expectedCollectionDate,null);check('cash baseline, five unscheduled invoices, 15-day scenario, no invoice mutation');
 for(const days of [30,60,90])assert.equal((await json(a,'/api/cash-forecast?forecast_days='+days)).forecast.chart.length,days+1);check('all three forecast horizons');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
 const addDays=n=>new Date(Date.parse(today)+n*86400000).toISOString().slice(0,10);
 const customer=(await json(a,'/api/customers','POST',{name:'Browser Test Buyer',phone:'9876543210',email:'buyer@example.invalid'},201)).customer;
 const create={customerId:customer.id,issueDate:today,dueDate:addDays(3),items:[{description:'Printed T-shirt',quantity:2,unitPrice:600}]};
 const draft=(await json(a,'/api/invoices','POST',create,201)).invoice;assert.ok(draft.invoiceNumber.startsWith('PD-'));assert.equal(draft.status,'draft');check('customer and automatic numbered itemised draft created');
 await json(a,`/api/invoices/${draft.id}/edit`,'PUT',{items:[{description:'Printed T-shirt',quantity:3,unitPrice:600}],dueDate:addDays(4),notes:'Gift order'});assert.equal(Number((await json(a,'/api/invoices/'+draft.id)).invoice.totalAmount),1800);check('invoice edits persist and recalculate total');
 await json(a,`/api/invoices/${draft.id}/issue`,'POST',{});
 const pay={amount:'500.00',paidOn:today,method:'upi',kind:'advance',idempotencyKey:'review-payment-1'};
 const first=await json(a,`/api/invoices/${draft.id}/payments`,'POST',pay,201);const retry=await json(a,`/api/invoices/${draft.id}/payments`,'POST',pay);assert.equal(first.payment.id,retry.payment.id);assert.equal(first.outstanding_balance,1300);
 await json(a,`/api/invoices/${draft.id}/payments`,'POST',{...pay,amount:600},409);
 await json(a,`/api/invoices/${draft.id}/payments`,'POST',{...pay,amount:2000,idempotencyKey:'overpay'},400);
 await json(a,`/api/invoices/${draft.id}/payments`,'POST',{...pay,paidOn:addDays(1),idempotencyKey:'future'},400);
 check('advance, exact retry, conflicting retry, overpayment and future-date checks');
 const end=await json(a,`/api/invoices/${draft.id}/payments`,'POST',{...pay,amount:1300,kind:'final',idempotencyKey:'review-payment-2'},201);assert.equal(end.status,'paid');assert.equal(end.outstanding_balance,0);assert.equal((await json(a,'/api/cash-forecast')).forecast.current_available_cash,9800);check('final payment updates status and actual cash');
 const reminder=(await json(a,`/api/invoices/${keyInvoice.id}/follow-ups`,'POST',{},201)).followUp??null;
 if(!reminder)throw new Error('Reminder response envelope mismatch');
 assert.equal(reminder.status,'draft');assert.match(reminder.body,/6,?000/);await json(a,`/api/follow-ups/${reminder.id}`,'PATCH',{body:'Reviewed reminder for ₹6,000'});await json(a,`/api/follow-ups/${reminder.id}/mark-sent`,'POST',{channel:'whatsapp'});check('invoice-specific reminder draft, edit and explicit mark sent');
 const bill=(await json(a,'/api/expenses','POST',{description:'Test delivery',category:'delivery',amount:80,dueDate:today},201)).expense;
 await json(a,`/api/expenses/${bill.id}/mark-paid`,'POST',{paid_on:today});assert.equal((await json(a,'/api/cash-forecast')).forecast.current_available_cash,9720);check('bill payment deducts actual cash once');
 await json(a,'/api/shops/'+me.shop_id,'PATCH',{openingCashBalance:0},400);await json(a,'/api/shops/'+me.shop_id,'PATCH',{openingCashBalance:0,openingBalanceEffectiveDate:today});assert.equal((await json(a,'/api/cash-forecast')).forecast.current_available_cash,1720);check('paired opening balance, valid zero and same-day cash movements');
 // Test database constraints directly; APIs must not be the only guard.
 const client=pg.getPgClient();await client.connect();await client.query('SET search_path TO public');
 await assert.rejects(client.query('UPDATE shops SET opening_balance_effective_date = NULL WHERE id = $1',[me.shop_id]));check('database rejects unpaired opening balance');await client.end();
 // Persistence through fresh browser session using its legitimate cookie.
 const state=await b.storageState();await b.dispose();const reload=await requests.newContext({baseURL:base,storageState:state});assert.ok((await json(reload,'/api/invoices')).invoices.length>=6);check('saved records and signed session persist across context restart');
 mkdirSync('review-artifacts',{recursive:true});
 writeFileSync('review-artifacts/results.json',JSON.stringify({passed:checks.length,checks},null,2));
 console.log('ALL',checks.length,'CHECKS PASSED');
}catch(e){console.error(e);process.exitCode=1;}finally{if(server){server.kill('SIGTERM');await new Promise(r=>setTimeout(r,500));}await pg.stop().catch(()=>{});}
