// Stub for '@/lib/db'. State is driven by globalThis.__fake set in the repro script.
const prisma = {
  shop: { findUnique: async () => ({ id: 'shop-1' }) },
  customer: { findFirst: async () => ({ id: 'cust-1' }) },
  invoice: {
    findFirst: async () => {
      const f = globalThis.__fake;
      return { ...f.invoice, payments: Array.from({ length: f.paymentCount }, (_, i) => ({ id: 'pay-' + i })) };
    },
    update: async (a) => { const f = globalThis.__fake; f.updates.push(a.data); Object.assign(f.invoice, a.data); return { ...f.invoice }; },
  },
};
module.exports = { prisma };
