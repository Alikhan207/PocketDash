import path from 'path';
const Module = require('module');

const calls: Array<{ op: string; args: unknown }> = [];
const invoice = {
  id: '11111111-1111-4111-8111-111111111111',
  shopId: 'shop-1',
  customerId: '22222222-2222-4222-8222-222222222222',
  status: 'partially_paid',
  issueDate: new Date('2025-03-01T00:00:00.000Z'),
  dueDate: new Date('2025-03-31T00:00:00.000Z'),
  expectedCollectionDate: null,
  notes: null,
  totalAmount: '1000.00',
};
const stubPrisma = {
  shop: { findUnique: async () => ({ id: 'shop-1' }) },
  customer: { findFirst: async () => ({ id: '22222222-2222-4222-8222-222222222222' }) },
  invoice: {
    findFirst: async (a: unknown) => {
      calls.push({ op: 'invoice.findFirst', args: a });
      return { ...invoice, payments: [{ id: 'pay-1' }] };
    },
    update: async (a: { data: Record<string, unknown> }) => {
      calls.push({ op: 'invoice.update', args: a });
      return { ...invoice, ...a.data, totalAmount: '1000.00' };
    },
  },
};
const stubSession = { requireUser: async () => ({ id: 'user-1', email: 'x@example.com' }) };

const origLoad = Module._load;
Module._load = function (request: string, ...rest: unknown[]) {
  if (request === '@/lib/db') return { prisma: stubPrisma };
  if (request === '@/lib/session') return stubSession;
  return origLoad.call(this, request, ...rest);
};

const routePath = path.resolve(__dirname, '../../src/app/api/invoices/[invoiceId]/route.ts');
const { PATCH } = require(routePath);

const invoiceId = invoice.id;
async function send(label: string, body: unknown) {
  calls.length = 0;
  const req = new Request(`http://localhost/api/invoices/${invoiceId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const res = await PATCH(req, { params: { invoiceId } });
  const text = await res.text();
  console.log(`--- ${label}  body=${JSON.stringify(body)}`);
  console.log(`status=${res.status}`);
  console.log(`response=${text}`);
  console.log(`prisma.invoice.update called: ${calls.some((c) => c.op === 'invoice.update')}`);
}

(async () => {
  await send('REQUEST 1', { expectedCollectionDate: '2025-04-10' });
  await send('REQUEST 2', { dueDate: '2025-04-10' });
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1); });
