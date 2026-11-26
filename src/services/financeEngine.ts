import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type DecimalValue = string | number | Prisma.Decimal;
const D = (v: DecimalValue) => new Prisma.Decimal(v);
const ZERO = D(0);
const r2 = (d: Prisma.Decimal) => d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const fmt = (d: Prisma.Decimal) => r2(d).toFixed(2);
const sum = (xs: Prisma.Decimal[]) => xs.reduce((a, b) => a.plus(b), ZERO);
const DAY = 86_400_000;

/* ───────────── Fechas (UTC, medianoche) ───────────── */

const dayStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
/** Día `day` del mes `m0` (0-11, admite desbordes), recortado al último día del mes. */
function dateOf(y: number, m0: number, day: number): Date {
  const last = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m0, Math.min(day, last)));
}
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

/* ───────────── 1. Ciclo de facturación de tarjetas ───────────── */

export interface BillingCycle {
  /** Ciclo ya cerrado: su estado de cuenta es lo que se paga (start/end inclusivos). */
  closedCycle: { start: Date; end: Date };
  /** Ciclo abierto: consumos que se facturan en el próximo corte. */
  openCycle: { start: Date; end: Date };
  nextCutoffDate: Date;
  /** Fecha límite de pago del ciclo cerrado. */
  paymentDueDate: Date;
  daysToCutoff: number;
  daysToPayment: number;
}

export function getCardBillingCycle(cutoffDay: number, paymentDueDay: number, referenceDate: Date): BillingCycle {
  const ref = dayStart(referenceDate);
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const thisCutoff = dateOf(y, m, cutoffDay);

  // El día de corte aún pertenece al ciclo que cierra ese día.
  const beforeCut = ref <= thisCutoff;
  const closedEnd = beforeCut ? dateOf(y, m - 1, cutoffDay) : thisCutoff;
  const openEnd = beforeCut ? thisCutoff : dateOf(y, m + 1, cutoffDay);
  const prevOfClosed = dateOf(closedEnd.getUTCFullYear(), closedEnd.getUTCMonth() - 1, cutoffDay);

  let due = dateOf(closedEnd.getUTCFullYear(), closedEnd.getUTCMonth(), paymentDueDay);
  if (due <= closedEnd) due = dateOf(closedEnd.getUTCFullYear(), closedEnd.getUTCMonth() + 1, paymentDueDay);

  return {
    closedCycle: { start: addDays(prevOfClosed, 1), end: closedEnd },
    openCycle: { start: addDays(closedEnd, 1), end: openEnd },
    nextCutoffDate: openEnd,
    paymentDueDate: due,
    daysToCutoff: Math.round((openEnd.getTime() - ref.getTime()) / DAY),
    daysToPayment: Math.round((due.getTime() - ref.getTime()) / DAY),
  };
}

/** Clasifica un consumo respecto al ciclo: por pagar este mes (BILLED) o próximo mes (NEXT). */
export function classifyCharge(cycle: BillingCycle, date: Date): "PAST" | "BILLED" | "NEXT" | "FUTURE" {
  const d = dayStart(date);
  if (d < cycle.closedCycle.start) return "PAST";
  if (d <= cycle.closedCycle.end) return "BILLED";
  if (d <= cycle.openCycle.end) return "NEXT";
  return "FUTURE";
}

/* ───────────── 2. Amortización de préstamos (sistema francés) ───────────── */

export interface LoanAmortization {
  monthlyPayment: string;
  remainingBalance: string;
  remainingInstallments: number;
  currentInterest: string;
  currentCapital: string;
  /** Cuota efectiva del próximo mes (la última puede ser menor). */
  nextPayment: string;
  totalRemainingInterest: string;
  totalRemainingPayments: string;
}

export function calculateLoanAmortization(
  principal: DecimalValue,
  annualRate: DecimalValue,
  totalInstallments: number,
  paidInstallments: number,
  monthlyPayment: DecimalValue,
): LoanAmortization {
  const rate = D(annualRate).div(100).div(12);
  const n = totalInstallments;
  let pay = D(monthlyPayment);
  if (pay.lte(0)) {
    // PMT = P·r / (1 − (1+r)^−n)
    pay = rate.isZero() ? D(principal).div(n) : D(principal).mul(rate).div(D(1).minus(D(1).plus(rate).pow(-n)));
  }
  pay = r2(pay);

  // Un paso del cronograma: interés, capital, pago y nuevo saldo.
  const step = (bal: Prisma.Decimal, isLast: boolean) => {
    const interest = r2(bal.mul(rate));
    const full = bal.plus(interest);
    const payment = isLast || full.lte(pay) ? full : pay;
    return { interest, capital: payment.minus(interest), payment, balance: bal.minus(payment.minus(interest)) };
  };

  let balance = D(principal);
  const paid = Math.min(Math.max(paidInstallments, 0), n);
  for (let i = 0; i < paid && balance.gt(0); i++) balance = step(balance, i === n - 1).balance;
  if (balance.lt(0)) balance = ZERO;

  const startBalance = balance;
  let totalInterest = ZERO;
  let totalPayments = ZERO;
  let first: ReturnType<typeof step> | null = null;
  for (let i = paid; i < n && balance.gt(0); i++) {
    const s = step(balance, i === n - 1);
    first ??= s;
    totalInterest = totalInterest.plus(s.interest);
    totalPayments = totalPayments.plus(s.payment);
    balance = s.balance;
  }

  return {
    monthlyPayment: fmt(pay),
    remainingBalance: fmt(startBalance),
    remainingInstallments: n - paid,
    currentInterest: fmt(first?.interest ?? ZERO),
    currentCapital: fmt(first?.capital ?? ZERO),
    nextPayment: fmt(first?.payment ?? ZERO),
    totalRemainingInterest: fmt(totalInterest),
    totalRemainingPayments: fmt(totalPayments),
  };
}

/* ───────────── 3. Gasto por categoría ───────────── */

/** Agrupa gastos por categoría, de mayor a menor, con su porcentaje (1 decimal) sobre el total. */
export function groupByCategory(expenses: { category: string; amount: Prisma.Decimal }[]) {
  const totals = new Map<string, Prisma.Decimal>();
  for (const t of expenses) totals.set(t.category, (totals.get(t.category) ?? ZERO).plus(t.amount));
  const total = sum([...totals.values()]);
  return [...totals]
    .sort(([a, x], [b, y]) => y.comparedTo(x) || a.localeCompare(b))
    .map(([category, amount]) => ({ category, total: fmt(amount), percentage: amount.div(total).mul(100).toFixed(1) }));
}

/* ───────────── 4. Resumen de flujo de caja mensual ───────────── */

export interface CashflowInput {
  month: number; // 1-12
  year: number;
  today: Date;
  accounts: { currency: string; balance: Prisma.Decimal }[];
  cards: { id: string; bankName: string; cardName: string; creditLimit: Prisma.Decimal; cutoffDay: number; paymentDueDay: number }[];
  loans: {
    id: string; lenderName: string; principalAmount: Prisma.Decimal; annualInterestRate: Prisma.Decimal;
    totalInstallments: number; paidInstallments: number; monthlyPayment: Prisma.Decimal; paymentDay: number;
  }[];
  plans: { name: string; type: string; monthlyTarget: Prisma.Decimal }[];
  fixedExpenses: { id: string; amount: Prisma.Decimal; active: boolean }[];
  transactions: { type: string; amount: Prisma.Decimal; category: string; date: Date; isHistorical: boolean; creditCardId: string | null; fixedExpenseId: string | null }[];
}

export function computeCashflowSummary(inp: CashflowInput) {
  const { month, year, today } = inp;
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const inMonth = (d: Date) => dayStart(d) >= monthStart && dayStart(d) <= monthEnd;
  const ref = today < monthStart ? monthStart : today > monthEnd ? monthEnd : dayStart(today);
  const real = inp.transactions.filter((t) => !t.isHistorical);

  // Liquidez (cálculos en PEN; otras monedas solo se reportan)
  const balances: Record<string, Prisma.Decimal> = {};
  for (const a of inp.accounts) balances[a.currency] = (balances[a.currency] ?? ZERO).plus(a.balance);
  const bankTotal = balances.PEN ?? ZERO;

  // Tarjetas
  const cardRows = inp.cards.map((c) => {
    const ctx = real.filter((t) => t.creditCardId === c.id);
    const charges = ctx.filter((t) => t.type === "EXPENSE");
    const payments = ctx.filter((t) => t.type === "CARD_PAYMENT");

    // Estado de cuenta cuyo vencimiento cae en el mes consultado
    const due = dateOf(year, month - 1, c.paymentDueDay);
    const stmt = getCardBillingCycle(c.cutoffDay, c.paymentDueDay, due).closedCycle;
    const billed = sum(charges.filter((t) => dayStart(t.date) >= stmt.start && dayStart(t.date) <= stmt.end).map((t) => t.amount));
    const paidAfterCut = sum(payments.filter((t) => dayStart(t.date) > stmt.end && dayStart(t.date) <= monthEnd).map((t) => t.amount));
    const dueThisMonth = Prisma.Decimal.max(ZERO, billed.minus(paidAfterCut));
    const nextMonth = sum(charges.filter((t) => dayStart(t.date) > stmt.end).map((t) => t.amount));

    const cycle = getCardBillingCycle(c.cutoffDay, c.paymentDueDay, ref);
    const used = Prisma.Decimal.max(ZERO, sum(charges.map((t) => t.amount)).minus(sum(payments.map((t) => t.amount))));
    return {
      dueThisMonth,
      detail: {
        id: c.id, bankName: c.bankName, cardName: c.cardName,
        creditLimit: fmt(c.creditLimit), used: fmt(used), available: fmt(c.creditLimit.minus(used)),
        statementCutoff: stmt.end, paymentDueDate: due,
        billedThisMonth: fmt(billed), dueThisMonth: fmt(dueThisMonth), nextMonthCharges: fmt(nextMonth),
        nextCutoffDate: cycle.nextCutoffDate, daysToCutoff: cycle.daysToCutoff,
      },
    };
  });
  const cardsDue = sum(cardRows.map((c) => c.dueThisMonth));

  // Préstamos (LOAN_PAYMENT no referencia un préstamo: se descuenta del total del mes)
  const loanPaid = sum(real.filter((t) => t.type === "LOAN_PAYMENT" && inMonth(t.date)).map((t) => t.amount));
  const loans = inp.loans.map((l) => ({
    id: l.id, lenderName: l.lenderName, paymentDay: l.paymentDay, totalInstallments: l.totalInstallments, paidInstallments: l.paidInstallments,
    ...calculateLoanAmortization(l.principalAmount, l.annualInterestRate, l.totalInstallments, l.paidInstallments, l.monthlyPayment),
  }));
  const loansDue = Prisma.Decimal.max(ZERO, sum(loans.map((l) => D(l.nextPayment))).minus(loanPaid));

  // Planes de ahorro / gustos
  const planSum = (type: string) => sum(inp.plans.filter((p) => p.type === type).map((p) => p.monthlyTarget));
  const savings = planSum("SAVINGS");
  const wants = planSum("WANTS");

  // Gastos fijos activos aún no pagados en el mes
  const paidFixed = new Set(real.filter((t) => t.fixedExpenseId && inMonth(t.date)).map((t) => t.fixedExpenseId));
  const fixedDue = sum(inp.fixedExpenses.filter((f) => f.active && !paidFixed.has(f.id)).map((f) => f.amount));

  // Movimientos del mes (incluye históricos, solo estadística)
  const monthTx = inp.transactions.filter((t) => inMonth(t.date));
  const income = sum(monthTx.filter((t) => t.type === "INCOME").map((t) => t.amount));
  const monthExpenses = monthTx.filter((t) => t.type === "EXPENSE");
  const expenses = sum(monthExpenses.map((t) => t.amount));

  const free = bankTotal.minus(cardsDue).minus(loansDue).minus(savings).minus(wants).minus(fixedDue);

  return {
    month, year,
    bankBalances: Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, fmt(v)])),
    bankTotal: fmt(bankTotal),
    cardsDue: fmt(cardsDue),
    loansDue: fmt(loansDue),
    fixedDue: fmt(fixedDue),
    savingsBudget: fmt(savings),
    wantsBudget: fmt(wants),
    income: fmt(income),
    expenses: fmt(expenses),
    expensesByCategory: groupByCategory(monthExpenses),
    commitments: fmt(cardsDue.plus(loansDue).plus(fixedDue).plus(savings).plus(wants)),
    /** Dinero Realmente Libre = liquidez − tarjetas del mes − cuotas − gastos fijos − ahorro − gustos. */
    freeMoney: fmt(free),
    projection: { amount: fmt(free), status: free.gte(0) ? ("SURPLUS" as const) : ("DEFICIT" as const) },
    cards: cardRows.map((c) => c.detail),
    loans,
  };
}

export type CashflowSummary = ReturnType<typeof computeCashflowSummary>;

export async function getMonthlyCashflowSummary(month: number, year: number, userId: string): Promise<CashflowSummary> {
  const [accounts, cards, loans, plans, fixedExpenses, transactions] = await Promise.all([
    prisma.bankAccount.findMany({ where: { userId } }),
    prisma.creditCard.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.monthlyPlan.findMany({ where: { userId } }),
    prisma.fixedExpense.findMany({ where: { userId, active: true } }),
    prisma.transaction.findMany({
      where: { userId },
      select: { type: true, amount: true, category: true, date: true, isHistorical: true, creditCardId: true, fixedExpenseId: true },
    }),
  ]);
  return computeCashflowSummary({ month, year, today: new Date(), accounts, cards, loans, plans, fixedExpenses, transactions });
}
