/**
 * Seed script: wipes all data and loads sample users, parties, labour,
 * expense categories and ~45 days of purchases, payments and expenses.
 *
 * Documents are created through the same services the API uses, so every
 * ledger and cash-book entry is posted exactly as in production.
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { addDays, toDbDate, todayString } from '../src/lib/dates';
import { formatVoucherNo, nextSerial, postExpense, postPayment } from '../src/lib/posting';
import { createPurchase } from '../src/modules/purchases/purchases.service';

// Deterministic pseudo-random numbers so every seed run produces the same data.
let state = 42;
const rand = () => {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
};
const between = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));
const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)];
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

async function reset() {
  // Children first. Counters are reset so numbering restarts at PUR-00001 / PV-00001.
  await prisma.cashEntry.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.purchaseLabour.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.labour.deleteMany();
  await prisma.party.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.counter.deleteMany();
}

async function main() {
  await reset();

  const [admin] = await Promise.all([
    prisma.user.create({
      data: { name: 'Admin', email: 'admin@example.com', passwordHash: await bcrypt.hash('admin123', 10), role: 'ADMIN' },
    }),
    prisma.user.create({
      data: { name: 'Staff User', email: 'staff@example.com', passwordHash: await bcrypt.hash('staff123', 10), role: 'STAFF' },
    }),
  ]);

  await prisma.setting.create({
    data: {
      key: 'default',
      businessName: 'Ahmad Traders',
      address: 'Plot 14, Industrial Area, Lahore',
      phone: '0300-1234567',
      currency: 'PKR',
      openingCash: 2000000,
      openingBank: 5000000,
    },
  });

  const partyData = [
    { name: 'Rehman Scrap Dealers', phone: '0301-5550101', address: 'Shahdara, Lahore', openingBalance: 25000, openingType: 'CR' as const },
    { name: 'Malik Paper Mills Waste', phone: '0302-5550102', address: 'Kot Lakhpat, Lahore', openingBalance: 0, openingType: 'CR' as const },
    { name: 'Chaudhry Plastic Collectors', phone: '0321-5550103', address: 'Gujranwala', openingBalance: 10000, openingType: 'DR' as const },
    { name: 'Bismillah Kabaar Khana', phone: '0333-5550104', address: 'Badami Bagh, Lahore', openingBalance: 0, openingType: 'CR' as const },
    { name: 'Sialkot Metal Waste', phone: '0345-5550105', address: 'Sialkot', cnic: '34603-1234567-1', openingBalance: 50000, openingType: 'CR' as const },
    { name: 'Faisal Cardboard Suppliers', phone: '0300-5550106', address: 'Faisalabad', openingBalance: 0, openingType: 'CR' as const },
    { name: 'Hamza Textile Waste', phone: '0312-5550107', address: 'Kasur', openingBalance: 0, openingType: 'CR' as const },
    { name: 'Old Supplier (inactive)', phone: '0300-5550108', address: 'Sheikhupura', openingBalance: 0, openingType: 'CR' as const, isActive: false },
  ];
  const parties = [];
  for (const p of partyData) parties.push(await prisma.party.create({ data: p }));
  const activeParties = parties.filter((p) => p.isActive);

  const labourNames = ['Akram', 'Bashir', 'Irfan', 'Javed', 'Kashif', 'Nadeem', 'Rashid', 'Shafiq', 'Tariq', 'Zahid'];
  const labour = [];
  for (const [i, name] of labourNames.entries()) {
    labour.push(
      await prisma.labour.create({
        data: { name, phone: `0310-55502${String(i).padStart(2, '0')}`, address: 'Lahore', defaultWage: pick([800, 1000, 1200]) },
      }),
    );
  }

  const categories = [];
  for (const name of ['Fuel', 'Electricity', 'Rent', 'Food', 'Maintenance', 'Miscellaneous']) {
    categories.push(await prisma.expenseCategory.create({ data: { name } }));
  }

  const materials = ['Mixed paper', 'Cardboard', 'Plastic (PET)', 'Plastic (HDPE)', 'Iron scrap', 'Textile waste', null];
  const vehicles = ['LES-4521', 'LEA-9087', 'FDA-3312', 'GAA-7745', 'SKT-1109', 'LHR-2268', 'KSR-6634'];
  const drivers = ['Aslam', 'Imran', 'Saleem', 'Waqas', 'Naveed'];
  const today = todayString();

  let purchaseCount = 0;
  for (let offset = 44; offset >= 0; offset--) {
    const date = addDays(today, -offset);
    const trucks = offset === 0 ? 2 : between(0, 3);
    for (let t = 0; t < trucks; t++) {
      const party = pick(activeParties);
      const gross = roundTo(between(9000, 26000), 10);
      const tare = roundTo(between(4000, 7500), 10);
      const net = gross - tare;
      const rate = pick([28, 32, 35, 40, 45, 55, 60]);
      const amount = net * rate;
      const truckRent = pick([0, 8000, 12000, 15000, 18000]);
      const paidBy = truckRent === 0 ? 'ME' : pick(['ME', 'ME', 'DEDUCT', 'PARTY'] as const);
      const deducted = paidBy === 'DEDUCT' ? truckRent : 0;
      const crew = [...labour].sort(() => rand() - 0.5).slice(0, between(2, 4));
      const paidNow = pick([0, 0.25, 0.5, 1]);
      await createPurchase(
        {
          date,
          partyId: party.id,
          vehicleNo: pick(vehicles),
          driverName: pick(drivers),
          driverPhone: `0300-${between(1000000, 9999999)}`,
          material: pick(materials),
          grossWeight: gross,
          tareWeight: tare,
          rate,
          amount: null,
          truckRent,
          truckRentPaidBy: paidBy,
          truckRentMethod: 'CASH',
          amountPaid: Math.floor(((amount - deducted) * paidNow) / 1000) * 1000,
          paymentMethod: paidNow === 1 ? 'BANK' : 'CASH',
          labours: crew.map((l) => ({ labourId: l.id, wage: pick([800, 1000, 1200, 1500]), paid: rand() < 0.4, paidMethod: 'CASH' as const })),
          notes: null,
        },
        admin.id,
      );
      purchaseCount++;
    }

    // Occasional payments to parties / labour, and routine expenses.
    if (offset % 4 === 1) {
      const party = pick(activeParties);
      await createPayment({ date, payeeType: 'PARTY', partyId: party.id, amount: roundTo(between(50000, 250000), 5000), method: pick(['CASH', 'BANK'] as const), note: 'Part payment' }, admin.id);
    }
    if (offset % 7 === 0) {
      for (const l of labour.slice(0, between(3, 6))) {
        await createPayment({ date, payeeType: 'LABOUR', labourId: l.id, amount: roundTo(between(2000, 5000), 500), method: 'CASH', note: 'Weekly wages' }, admin.id);
      }
    }
    if (offset % 2 === 0) {
      // Sales of sorted material are recorded as receipts from "other" payees.
      await createPayment({ date, payeeType: 'OTHER', direction: 'IN', payeeName: pick(['Sale of sorted bales', 'Recycling mill sale']), amount: roundTo(between(500000, 1100000), 10000), method: offset % 4 === 0 ? 'BANK' : 'CASH', note: null }, admin.id);
    }
    if (rand() < 0.6) await createExpense(date, categories[0].id, between(2, 8) * 1000, 'Pump', 'Diesel for loader', admin.id);
    if (rand() < 0.5) await createExpense(date, categories[3].id, between(5, 15) * 100, 'Dhaba', 'Staff lunch', admin.id);
    if (offset % 30 === 5) {
      await createExpense(date, categories[1].id, between(15, 35) * 1000, 'LESCO', 'Monthly electricity bill', admin.id);
      await createExpense(date, categories[2].id, 80000, 'Landlord', 'Yard rent', admin.id);
    }
    if (offset % 15 === 8) await createExpense(date, categories[4].id, between(3, 20) * 1000, 'Mechanic', 'Weighbridge / loader repair', admin.id);
  }

  console.log(`Seeded ${parties.length} parties, ${labour.length} labour, ${purchaseCount} purchases.`);
  console.log('Login: admin@example.com / admin123  (staff: staff@example.com / staff123)');
}

async function createPayment(
  input: {
    date: string;
    payeeType: 'PARTY' | 'LABOUR' | 'OTHER';
    direction?: 'IN' | 'OUT';
    partyId?: string;
    labourId?: string;
    payeeName?: string;
    amount: number;
    method: 'CASH' | 'BANK';
    note: string | null;
  },
  userId: string,
) {
  await prisma.$transaction(async (tx) => {
    const serialNo = await nextSerial(tx, 'payment');
    const p = await tx.payment.create({
      data: { ...input, date: toDbDate(input.date), serialNo, voucherNo: formatVoucherNo(serialNo), createdById: userId },
    });
    await postPayment(tx, p.id);
  });
}

async function createExpense(date: string, categoryId: string, amount: number, paidTo: string, description: string, userId: string) {
  await prisma.$transaction(async (tx) => {
    const e = await tx.expense.create({
      data: { date: toDbDate(date), categoryId, amount, paidTo, description, paymentMethod: 'CASH', createdById: userId },
    });
    await postExpense(tx, e.id);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
