// Throwaway repro: loads the REAL PATCH handler from src/app/api/invoices/[invoiceId]/route.ts
// with stubbed prisma (no DB) and MOCK_MODE session (no login).
import * as path from 'path';
import { pathToFileURL } from 'url';
const Module = require('module');
process.env.MOCK_MODE = 'true';
const STUBS = path.resolve(__dirname, 'stubs');
const INV = '6f1d2c3a-1111-4222-8333-444455556666';
const fresh = () => ({
  paymentCount: 1, updates: [] as any[],
  invoice: {
    id: INV, shopId: 'shop-1', customerId: 'cust-1', invoiceNumber: 'PD-2025-002',
    status: 'partially_paid', totalAmount: '1000.00', notes: null,
    issueDate: new Date('2025-01-01T00:00:00Z'), dueDate: new Date('2025-02-01T00:00:00Z'),
    expectedCollectionDate: null as any,
  },
});
(globalThis as any).__fake = fresh();
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...rest: any[]) {
  if (request === '@/lib/db') return path.join(STUBS, 'db-stub.js');
  if (request === '@prisma/client') return path.join(STUBS, 'prisma-stub.js');
  return origResolve.call(this, request, ...rest);
};
async function main() {
  const routePath = path.resolve(__dirname, '..', '..', 'src', 'app', 'api', 'invoices', '[invoiceId]', 'route.ts');
  const { PATCH } = await import(pathToFileURL(routePath).href);
  const cases: Array<[string, number, Record<string, unknown>]> = [
    ['A camelCase expectedCollectionDate, partly paid (1 payment)', 1, { expectedCollectionDate: '2025-03-15' }],
    ['B snake_case expected_collection_date, partly paid (1 payment)', 1, { expected_collection_date: '2025-03-15' }],
    ['C control: dueDate change, partly paid (1 payment)', 1, { dueDate: '2025-02-10' }],
    ['D control: camelCase expectedCollectionDate, no payments', 0, { expectedCollectionDate: '2025-03-15' }],
  ];
  for (const [label, pays, body] of cases) {
    (globalThis as any).__fake = fresh();
    const f = (globalThis as any).__fake;
    f.paymentCount = pays;
    const req = new Request('http://localhost/api/invoices/' + INV, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const res = await PATCH(req, { params: { invoiceId: INV } });
    const text = await res.text();
    console.log(`\n== ${label}\n   request body: ${JSON.stringify(body)}\n   HTTP ${res.status}\n   response: ${text.slice(0, 220)}\n   prisma.update data: ${JSON.stringify(f.updates)}`);
  }
}
main().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
