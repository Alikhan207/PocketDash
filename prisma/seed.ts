// Demo data — rendered by the pipeline from prisma/schema.prisma. One account per
// role (<role>@example.com, password DEMO_PASSWORD from .env) plus demo@example.com, then every table,
// parents first. Every insert is non-fatal; safe to run again.
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const db = new PrismaClient();
const ids: Record<string, Array<string | number>> = {};
const users: Record<string, string | number> = {};
function pick(model: string, i: number): string | number | undefined {
  const list = ids[model] || [];
  return list.length ? list[i % list.length] : undefined;
}
function why(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 200) ?? m;
}

async function main() {
  // DEMO_PASSWORD in .env, random for each project. Unset, nobody can sign in as the demo accounts.
  const demoPassword = process.env.DEMO_PASSWORD || randomUUID();
  if (!process.env.DEMO_PASSWORD) console.log('[seed] demo accounts: DEMO_PASSWORD is not set in .env, so nobody can sign in as them');
  try {
    const u = await db.user.upsert({ where: { email: "demo@example.com" }, update: { isDemo: true }, create: { id: "00000000-0000-4000-8000-000000000001", email: "demo@example.com", name: "Demo User", clerkUserId: "User clerkUserId 1", isDemo: true } });
    if (!users["seller"]) users["seller"] = u.id;
    (ids["User"] ??= []).push(u.id);
    console.log('[seed] demo-user: ok demo@example.com');
  } catch (e) {
    console.log('[seed] demo-user: MISSING — ' + why(e));
  }
  try {
    const u = await db.user.upsert({ where: { email: "seller@example.com" }, update: {}, create: { email: "seller@example.com", name: "Demo Seller", clerkUserId: "User clerkUserId 2" } });
    if (!users["seller"]) users["seller"] = u.id;
    (ids["User"] ??= []).push(u.id);
    console.log('[seed] account: ok seller@example.com');
  } catch (e) {
    console.log('[seed] account seller@example.com: ' + why(e));
  }
  try {
    if ((await db.shop.count()) === 0) {
      // One demo user per shop row, because Shop.userId is unique.
      const shopOwners: Array<string | number | undefined> = [];
      for (let n = 1; n <= 4; n++) {
        try {
          const u = await db.user.upsert({ where: { email: `shop-owner-${n}@example.com` }, update: {}, create: { email: `shop-owner-${n}@example.com`, name: `Shop Owner ${n}`, clerkUserId: `User clerkUserId ${n + 2}` } });
          shopOwners.push(u.id);
        } catch (e) {
          console.log('[seed] shop owner ' + n + ' skipped: ' + why(e));
          shopOwners.push(undefined);
        }
      }
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ userId: shopOwners[0] ?? pick("User", 0), name: "Loopy Threads & Tees", phone: "+91 98200 44317", email: "hello@loopythreads.example.com", address: "12 Sadashiv Peth, Pune, Maharashtra 411030", openingCashBalance: 18500, openingBalanceEffectiveDate: new Date("2025-03-01T00:00:00Z") }),
        () => ({ userId: shopOwners[1] ?? pick("User", 1), name: "Shop name 2" }),
        () => ({ userId: shopOwners[2] ?? pick("User", 2), name: "Shop name 3" }),
        () => ({ userId: shopOwners[3] ?? pick("User", 3), name: "Shop name 4" }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.shop.create({ data: row() as never });
          (ids["Shop"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Shop row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Shop: ${ok}/${rows.length} rows`);
    } else {
      ids["Shop"] = (await db.shop.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Shop skipped: ' + why(e));
  }
  try {
    if ((await db.alert.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ shopId: pick("Shop", 0), alertType: "overdue_invoice", status: "active", invoiceId: pick("Invoice", 0), expenseId: pick("Expens", 0), shortageDate: new Date("2025-04-02T00:00:00Z"), shortageAmount: 1850, message: "PD-2025-003 from Rhea Mehta is 3 days past due for ₹800.", actionTakenAt: new Date("2025-03-22T10:05:00Z"), resolvedAt: new Date("2025-03-17T09:00:00Z") }),
        () => ({ shopId: pick("Shop", 1), alertType: "upcoming_bill", status: "active", invoiceId: pick("Invoice", 1), expenseId: pick("Expens", 1), shortageDate: new Date("2025-04-02T00:00:00Z"), shortageAmount: 1850, message: "Yarn bundle ₹2,800 is due on 15 March.", actionTakenAt: new Date("2025-03-16T19:30:00Z"), resolvedAt: new Date("2025-03-17T09:00:00Z") }),
        () => ({ shopId: pick("Shop", 2), alertType: "cash_shortage", status: "active", invoiceId: pick("Invoice", 2), expenseId: pick("Expens", 2), shortageDate: new Date("2025-04-02T00:00:00Z"), shortageAmount: 1850, message: "Cash may dip below zero on 2 April after upcoming bills.", actionTakenAt: new Date("2025-03-16T19:30:00Z"), resolvedAt: new Date("2025-03-17T09:00:00Z") }),
        () => ({ shopId: pick("Shop", 3), alertType: "overdue_no_expected_date", status: "resolved", invoiceId: pick("Invoice", 3), expenseId: pick("Expens", 3), shortageDate: new Date("2025-04-02T00:00:00Z"), shortageAmount: 1850, message: "PD-2025-004 had no expected date. Kabir confirmed the 30th.", actionTakenAt: new Date("2025-03-16T19:30:00Z"), resolvedAt: new Date("2025-03-17T09:00:00Z") }),
        () => ({ shopId: pick("Shop", 4), alertType: "upcoming_bill", status: "resolved", invoiceId: pick("Invoice", 4), expenseId: pick("Expens", 4), shortageDate: new Date("2025-04-02T00:00:00Z"), shortageAmount: 1850, message: "Blank tees ₹9,500 were paid on 4 March.", actionTakenAt: new Date("2025-03-04T15:00:00Z"), resolvedAt: new Date("2025-03-04T15:05:00Z") }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.alert.create({ data: row() as never });
          (ids["Alert"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Alert row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Alert: ${ok}/${rows.length} rows`);
    } else {
      ids["Alert"] = (await db.alert.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Alert skipped: ' + why(e));
  }
  try {
    if ((await db.customer.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ shopId: pick("Shop", 0), name: "Anika Rao", phone: "+91 98230 11234", email: "anika.rao@example.com" }),
        () => ({ shopId: pick("Shop", 1), name: "Rhea Mehta", phone: "+91 98220 55678", email: "rhea.mehta@example.com" }),
        () => ({ shopId: pick("Shop", 2), name: "Kabir Joshi", phone: "+91 91580 32190", email: "kabir.joshi@example.com" }),
        () => ({ shopId: pick("Shop", 3), name: "Sneha Iyer", phone: "+91 99600 78845", email: "dev.malhotra@example.com" }),
        () => ({ shopId: pick("Shop", 4), name: "Dev Malhotra", phone: "+91 97660 20413", email: "dev.malhotra@example.com" }),
        () => ({ shopId: pick("Shop", 5), name: "Priya Kulkarni", phone: "+91 98815 09762", email: "priya.k@example.com" }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.customer.create({ data: row() as never });
          (ids["Customer"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Customer row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Customer: ${ok}/${rows.length} rows`);
    } else {
      ids["Customer"] = (await db.customer.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Customer skipped: ' + why(e));
  }
  try {
    if ((await db.expens.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ shopId: pick("Shop", 0), description: "Blank cotton tees, 50 pcs", category: "blank_t_shirts", amount: 9500, dueDate: new Date("2025-03-05T00:00:00Z"), status: "paid", paidOn: new Date("2025-03-04T15:00:00Z"), revisedPaymentDate: new Date("2025-03-24T00:00:00Z") }),
        () => ({ shopId: pick("Shop", 1), description: "DTF printing film and ink refill", category: "printing", amount: 3200, dueDate: new Date("2025-03-20T00:00:00Z"), status: "unpaid", paidOn: null, revisedPaymentDate: new Date("2025-03-24T00:00:00Z") }),
        () => ({ shopId: pick("Shop", 2), description: "Crochet yarn bundle, mixed pastels", category: "yarn", amount: 2800, dueDate: new Date("2025-03-15T00:00:00Z"), status: "unpaid", paidOn: null, revisedPaymentDate: new Date("2025-03-24T00:00:00Z") }),
        () => ({ shopId: pick("Shop", 3), description: "Poly mailers and tissue paper", category: "packaging", amount: 1450, dueDate: new Date("2025-03-10T00:00:00Z"), status: "paid", paidOn: new Date("2025-03-09T12:20:00Z"), revisedPaymentDate: new Date("2025-03-24T00:00:00Z") }),
        () => ({ shopId: pick("Shop", 4), description: "Weekly courier pickup", category: "delivery", amount: 900, dueDate: new Date("2025-03-28T00:00:00Z"), status: "unpaid", paidOn: null, revisedPaymentDate: new Date("2025-03-24T00:00:00Z") }),
        () => ({ shopId: pick("Shop", 5), description: "Canva Pro and phone plan", category: "other", amount: 499, dueDate: new Date("2025-04-01T00:00:00Z"), status: "unpaid", paidOn: null, revisedPaymentDate: new Date("2025-03-24T00:00:00Z") }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.expens.create({ data: row() as never });
          (ids["Expens"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Expens row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Expens: ${ok}/${rows.length} rows`);
    } else {
      ids["Expens"] = (await db.expens.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Expens skipped: ' + why(e));
  }
  try {
    if ((await db.savedItem.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ shopId: pick("Shop", 0), description: "Personalised cotton tee – name print", unitPrice: 450 }),
        () => ({ shopId: pick("Shop", 1), description: "Team jersey – custom back print", unitPrice: 300 }),
        () => ({ shopId: pick("Shop", 2), description: "Crochet rose bouquet", unitPrice: 400 }),
        () => ({ shopId: pick("Shop", 3), description: "Crochet teddy gift box", unitPrice: 400 }),
        () => ({ shopId: pick("Shop", 4), description: "Embroidered initial hoodie", unitPrice: 950 }),
        () => ({ shopId: pick("Shop", 5), description: "Canvas tote bag – doodle print", unitPrice: 500 }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.savedItem.create({ data: row() as never });
          (ids["SavedItem"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] SavedItem row skipped: ' + why(e));
        }
      }
      console.log(`[seed] SavedItem: ${ok}/${rows.length} rows`);
    } else {
      ids["SavedItem"] = (await db.savedItem.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] SavedItem skipped: ' + why(e));
  }
  try {
    if ((await db.invoice.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ shopId: pick("Shop", 0), customerId: pick("Customer", 0), invoiceNumber: "PD-2025-001", status: "paid", issueDate: new Date("2025-03-02T10:30:00Z"), dueDate: new Date("2025-03-09T10:30:00Z"), expectedCollectionDate: new Date("2025-03-25T09:15:00Z"), totalAmount: 1350, notes: "Birthday tees for Anika's friend group" }),
        () => ({ shopId: pick("Shop", 1), customerId: pick("Customer", 1), invoiceNumber: "PD-2025-002", status: "partially_paid", issueDate: new Date("2025-03-10T09:15:00Z"), dueDate: new Date("2025-03-17T09:15:00Z"), expectedCollectionDate: new Date("2025-03-25T09:15:00Z"), totalAmount: 2400, notes: "Team jersey order, balance due on delivery" }),
        () => ({ shopId: pick("Shop", 2), customerId: pick("Customer", 2), invoiceNumber: "PD-2025-003", status: "unpaid", issueDate: new Date("2025-03-14T16:00:00Z"), dueDate: new Date("2025-03-21T16:00:00Z"), expectedCollectionDate: new Date("2025-03-30T11:00:00Z"), totalAmount: 800, notes: "Rose bouquets for a surprise proposal" }),
        () => ({ shopId: pick("Shop", 3), customerId: pick("Customer", 3), invoiceNumber: "PD-2025-004", status: "unpaid", issueDate: new Date("2025-02-20T11:00:00Z"), dueDate: new Date("2025-02-27T11:00:00Z"), expectedCollectionDate: new Date("2025-03-30T11:00:00Z"), totalAmount: 1600, notes: "Customer said salary arrives on the 30th" }),
        () => ({ shopId: pick("Shop", 4), customerId: pick("Customer", 4), invoiceNumber: "PD-2025-005", status: "draft", issueDate: new Date("2025-03-18T14:20:00Z"), dueDate: new Date("2025-03-25T14:20:00Z"), expectedCollectionDate: new Date("2025-03-25T09:15:00Z"), totalAmount: 950, notes: "Waiting for final design approval" }),
        () => ({ shopId: pick("Shop", 5), customerId: pick("Customer", 5), invoiceNumber: "PD-2025-006", status: "cancelled", issueDate: new Date("2025-03-05T12:45:00Z"), dueDate: new Date("2025-03-12T12:45:00Z"), expectedCollectionDate: new Date("2025-03-25T09:15:00Z"), totalAmount: 500, notes: "Customer changed design, reissued as PD-2025-005" }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.invoice.create({ data: row() as never });
          (ids["Invoice"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Invoice row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Invoice: ${ok}/${rows.length} rows`);
    } else {
      ids["Invoice"] = (await db.invoice.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Invoice skipped: ' + why(e));
  }
  try {
    if ((await db.followUp.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ invoiceId: pick("Invoice", 0), body: "Hi Rhea, just checking on the ₹800 for PD-2025-003. Could you share the UPI payment today? Thank you!", status: "sent", channel: "whatsapp", sentAt: new Date("2025-03-22T10:05:00Z") }),
        () => ({ invoiceId: pick("Invoice", 1), body: "Hi Sneha, a friendly reminder that the balance for your jersey order is due by 25 March.", status: "draft", channel: "copied", sentAt: null }),
        () => ({ invoiceId: pick("Invoice", 2), body: "Hi Kabir, your gift box invoice PD-2025-004 is past due. Please let me know when to expect payment.", status: "sent", channel: "copied", sentAt: new Date("2025-03-16T19:30:00Z") }),
        () => ({ invoiceId: pick("Invoice", 3), body: "Hi Dev, here is the updated invoice for your hoodie. Let me know if the design looks good.", status: "draft", channel: "other", sentAt: null }),
        () => ({ invoiceId: pick("Invoice", 4), body: "Hi Priya, thanks for the order! Gentle reminder about the remaining balance before pickup.", status: "sent", channel: "whatsapp", sentAt: new Date("2025-03-18T12:15:00Z") }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.followUp.create({ data: row() as never });
          (ids["FollowUp"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] FollowUp row skipped: ' + why(e));
        }
      }
      console.log(`[seed] FollowUp: ${ok}/${rows.length} rows`);
    } else {
      ids["FollowUp"] = (await db.followUp.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] FollowUp skipped: ' + why(e));
  }
  try {
    if ((await db.invoiceItem.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ invoiceId: pick("Invoice", 0), description: "Personalised cotton tee – name print", quantity: 3, unitPrice: 450, lineTotal: 1350 }),
        () => ({ invoiceId: pick("Invoice", 1), description: "Team jersey – custom back print", quantity: 8, unitPrice: 300, lineTotal: 2400 }),
        () => ({ invoiceId: pick("Invoice", 2), description: "Crochet rose bouquet", quantity: 2, unitPrice: 400, lineTotal: 800 }),
        () => ({ invoiceId: pick("Invoice", 3), description: "Crochet teddy gift box", quantity: 4, unitPrice: 400, lineTotal: 1600 }),
        () => ({ invoiceId: pick("Invoice", 4), description: "Embroidered initial hoodie", quantity: 1, unitPrice: 950, lineTotal: 950 }),
        () => ({ invoiceId: pick("Invoice", 5), description: "Canvas tote bag – doodle print", quantity: 1, unitPrice: 500, lineTotal: 500 }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.invoiceItem.create({ data: row() as never });
          (ids["InvoiceItem"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] InvoiceItem row skipped: ' + why(e));
        }
      }
      console.log(`[seed] InvoiceItem: ${ok}/${rows.length} rows`);
    } else {
      ids["InvoiceItem"] = (await db.invoiceItem.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] InvoiceItem skipped: ' + why(e));
  }
  try {
    if ((await db.payment.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ invoiceId: pick("Invoice", 0), amount: 500, paidOn: new Date("2025-03-03T13:10:00Z"), method: "upi", kind: "advance", verificationStatus: "seller_recorded", idempotencyKey: "pay-20250303-upi-500" }),
        () => ({ invoiceId: pick("Invoice", 1), amount: 850, paidOn: new Date("2025-03-08T18:40:00Z"), method: "upi", kind: "final", verificationStatus: "seller_recorded", idempotencyKey: "pay-20250308-upi-850" }),
        () => ({ invoiceId: pick("Invoice", 2), amount: 1200, paidOn: new Date("2025-03-12T11:05:00Z"), method: "bank_transfer", kind: "advance", verificationStatus: "seller_recorded", idempotencyKey: "pay-20250312-bank-1200" }),
        () => ({ invoiceId: pick("Invoice", 3), amount: 400, paidOn: new Date("2025-03-19T17:25:00Z"), method: "cash", kind: "partial", verificationStatus: "seller_recorded", idempotencyKey: "pay-20250319-cash-400" }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.payment.create({ data: row() as never });
          (ids["Payment"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Payment row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Payment: ${ok}/${rows.length} rows`);
    } else {
      ids["Payment"] = (await db.payment.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Payment skipped: ' + why(e));
  }
  try {
    if ((await db.scenario.count()) === 0) {
      const rows: Array<() => Record<string, unknown>> = [
        () => ({ shopId: pick("Shop", 0), invoiceId: pick("Invoice", 0), status: "active", delayDays: 0, forecastDays: 30, scenarioExpectedCollectionDate: new Date("2025-04-06T00:00:00Z"), baselineMinCash: 4200, scenarioMinCash: 4200, baselineFirstShortageDate: new Date("2025-05-01T00:00:00Z"), scenarioFirstShortageDate: new Date("2025-04-02T00:00:00Z"), shortageAmount: 950, suggestedAction: "Ask Kabir for the ₹1,600 on 30 March instead.", isBaseline: true }),
        () => ({ shopId: pick("Shop", 1), invoiceId: pick("Invoice", 1), status: "reset", delayDays: 7, forecastDays: 60, scenarioExpectedCollectionDate: new Date("2025-04-06T00:00:00Z"), baselineMinCash: 4200, scenarioMinCash: -950, baselineFirstShortageDate: new Date("2025-05-01T00:00:00Z"), scenarioFirstShortageDate: new Date("2025-04-02T00:00:00Z"), shortageAmount: 950, suggestedAction: "Ask Kabir for the ₹1,600 on 30 March instead.", isBaseline: false }),
        () => ({ shopId: pick("Shop", 2), invoiceId: pick("Invoice", 2), status: "active", delayDays: 14, forecastDays: 90, scenarioExpectedCollectionDate: new Date("2025-04-13T00:00:00Z"), baselineMinCash: 3100, scenarioMinCash: -2200, baselineFirstShortageDate: new Date("2025-05-01T00:00:00Z"), scenarioFirstShortageDate: new Date("2025-04-02T00:00:00Z"), shortageAmount: 2200, suggestedAction: "Delay printing restock to 25 April and chase PD-2025-002 balance.", isBaseline: false }),
        () => ({ shopId: pick("Shop", 3), invoiceId: pick("Invoice", 3), status: "active", delayDays: 3, forecastDays: 30, scenarioExpectedCollectionDate: new Date("2025-03-28T00:00:00Z"), baselineMinCash: 4200, scenarioMinCash: 1350, baselineFirstShortageDate: new Date("2025-05-01T00:00:00Z"), scenarioFirstShortageDate: new Date("2025-03-30T00:00:00Z"), shortageAmount: 4100, suggestedAction: "Cash stays positive if the PD-2025-002 balance arrives by 28 March.", isBaseline: false }),
        () => ({ shopId: pick("Shop", 4), invoiceId: pick("Invoice", 4), status: "reset", delayDays: 21, forecastDays: 60, scenarioExpectedCollectionDate: new Date("2025-04-11T00:00:00Z"), baselineMinCash: 3100, scenarioMinCash: -4100, baselineFirstShortageDate: new Date("2025-05-01T00:00:00Z"), scenarioFirstShortageDate: new Date("2025-03-30T00:00:00Z"), shortageAmount: 4100, suggestedAction: "Request a 50% advance on any new bulk order before buying yarn.", isBaseline: false }),
      ];
      let ok = 0;
      for (const row of rows) {
        try {
          const r = await db.scenario.create({ data: row() as never });
          (ids["Scenario"] ??= []).push((r as { id: string | number }).id);
          ok++;
        } catch (e) {
          console.log('[seed] Scenario row skipped: ' + why(e));
        }
      }
      console.log(`[seed] Scenario: ${ok}/${rows.length} rows`);
    } else {
      ids["Scenario"] = (await db.scenario.findMany({ take: 50, select: { id: true } } as never) as Array<{ id: string | number }>).map((r) => r.id);
    }
  } catch (e) {
    console.log('[seed] Scenario skipped: ' + why(e));
  }
}

main()
  .then(async () => { await db.$disconnect(); })
  .catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
