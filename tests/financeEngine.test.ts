import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "../src/generated/prisma/client";
import {
  calculateLoanAmortization,
  classifyCharge,
  computeCashflowSummary,
  getCardBillingCycle,
} from "../src/services/financeEngine";

const D = (v: string | number) => new Prisma.Decimal(v);
const utc = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/* ───────── getCardBillingCycle (corte 15, pago 10) ───────── */

test("ciclo: antes del corte (10-nov) → cerrado 16-sep..15-oct, abierto 16-oct..15-nov", () => {
  const c = getCardBillingCycle(15, 10, utc("2026-11-10"));
  assert.equal(iso(c.closedCycle.start), "2026-09-16");
  assert.equal(iso(c.closedCycle.end), "2026-10-15");
  assert.equal(iso(c.openCycle.start), "2026-10-16");
  assert.equal(iso(c.openCycle.end), "2026-11-15");
  assert.equal(iso(c.nextCutoffDate), "2026-11-15");
  assert.equal(iso(c.paymentDueDate), "2026-11-10");
  assert.equal(c.daysToCutoff, 5);
  assert.equal(c.daysToPayment, 0);
});

test("ciclo: el día del corte aún pertenece al ciclo que cierra", () => {
  const c = getCardBillingCycle(15, 10, utc("2026-11-15"));
  assert.equal(iso(c.closedCycle.end), "2026-10-15");
  assert.equal(c.daysToCutoff, 0);
});

test("ciclo: después del corte (20-nov) → cerrado 16-oct..15-nov, pago 10-dic", () => {
  const c = getCardBillingCycle(15, 10, utc("2026-11-20"));
  assert.equal(iso(c.closedCycle.start), "2026-10-16");
  assert.equal(iso(c.closedCycle.end), "2026-11-15");
  assert.equal(iso(c.openCycle.end), "2026-12-15");
  assert.equal(iso(c.paymentDueDate), "2026-12-10");
  assert.equal(c.daysToPayment, 20);
});

test("ciclo: corte 31 se recorta a fin de mes (febrero)", () => {
  const c = getCardBillingCycle(31, 10, utc("2026-02-10"));
  assert.equal(iso(c.nextCutoffDate), "2026-02-28");
});

test("classifyCharge: compras antes vs. después del corte (ref 20-nov)", () => {
  const c = getCardBillingCycle(15, 10, utc("2026-11-20"));
  assert.equal(classifyCharge(c, utc("2026-10-10")), "PAST");
  assert.equal(classifyCharge(c, utc("2026-10-20")), "BILLED");
  assert.equal(classifyCharge(c, utc("2026-11-15")), "BILLED");
  assert.equal(classifyCharge(c, utc("2026-11-16")), "NEXT");
  assert.equal(classifyCharge(c, utc("2026-12-16")), "FUTURE");
});

/* ───────── calculateLoanAmortization (6000, 18%, 12 cuotas) ───────── */

test("préstamo: cuota, interés y capital de la primera cuota", () => {
  const a = calculateLoanAmortization(6000, 18, 12, 0, 550.08);
  assert.equal(a.monthlyPayment, "550.08");
  assert.equal(a.remainingBalance, "6000.00");
  assert.equal(a.currentInterest, "90.00"); // 6000 × 1.5%
  assert.equal(a.currentCapital, "460.08"); // 550.08 − 90.00
  assert.equal(a.remainingInstallments, 12);
});

test("préstamo: cuota calculada (PMT) si monthlyPayment = 0", () => {
  assert.equal(calculateLoanAmortization(6000, 18, 12, 0, 0).monthlyPayment, "550.08");
});

test("préstamo: saldo e interés tras 1 cuota pagada", () => {
  const a = calculateLoanAmortization(6000, 18, 12, 1, 550.08);
  assert.equal(a.remainingBalance, "5539.92");
  assert.equal(a.currentInterest, "83.10"); // 5539.92 × 1.5%
  assert.equal(a.currentCapital, "466.98");
  assert.equal(a.remainingInstallments, 11);
});

test("préstamo: pagos restantes = saldo + intereses restantes; cierre en 0", () => {
  const a = calculateLoanAmortization(6000, 18, 12, 0, 550.08);
  const total = D(a.totalRemainingPayments);
  assert.ok(total.minus(a.totalRemainingInterest).minus(6000).abs().lte("0.01"));
  const done = calculateLoanAmortization(6000, 18, 12, 12, 550.08);
  assert.equal(done.remainingBalance, "0.00");
  assert.equal(done.nextPayment, "0.00");
});

/* ───────── Dinero Realmente Libre ───────── */

test("dinero libre = bancos − tarjetas − cuotas − fijos − ahorro − gustos", () => {
  const card = { id: "c1", bankName: "X", cardName: "Y", creditLimit: D(3000), cutoffDay: 15, paymentDueDay: 10 };
  const tx = (type: string, amount: number, date: string, extra = {}) => ({
    type, amount: D(amount), date: utc(date), isHistorical: false, creditCardId: null, fixedExpenseId: null, ...extra,
  });
  const s = computeCashflowSummary({
    month: 12, year: 2026, today: utc("2026-11-24"),
    accounts: [{ currency: "PEN", balance: D(5000) }, { currency: "PEN", balance: D(1000) }],
    cards: [card],
    loans: [{
      id: "l1", lenderName: "L", principalAmount: D(6000), annualInterestRate: D(18),
      totalInstallments: 12, paidInstallments: 0, monthlyPayment: D("550.08"), paymentDay: 5,
    }],
    plans: [{ name: "Ahorro", type: "SAVINGS", monthlyTarget: D(400) }, { name: "Gustos", type: "WANTS", monthlyTarget: D(100) }],
    fixedExpenses: [
      { id: "f1", amount: D(120), active: true },
      { id: "f2", amount: D("99.90"), active: true },
      { id: "f3", amount: D(999), active: false },
    ],
    transactions: [
      tx("EXPENSE", 250, "2026-11-05", { creditCardId: "c1" }),
      tx("EXPENSE", 180, "2026-11-12", { creditCardId: "c1" }),
      tx("EXPENSE", 300, "2026-11-20", { creditCardId: "c1" }), // post-corte: no exigible en dic
      tx("CARD_PAYMENT", 200, "2026-11-18", { creditCardId: "c1" }),
    ],
  });
  assert.equal(s.cardsDue, "230.00"); // (250+180) − 200
  assert.equal(s.cards[0].nextMonthCharges, "300.00");
  assert.equal(s.loansDue, "550.08");
  assert.equal(s.fixedDue, "219.90");
  assert.equal(s.commitments, "1499.98");
  assert.equal(s.freeMoney, "4500.02"); // 6000 − 230 − 550.08 − 219.90 − 500
  assert.equal(s.projection.status, "SURPLUS");
});

test("dinero libre negativo → DEFICIT", () => {
  const s = computeCashflowSummary({
    month: 11, year: 2026, today: utc("2026-11-24"),
    accounts: [{ currency: "PEN", balance: D(100) }], cards: [], loans: [],
    plans: [{ name: "Meta", type: "SAVINGS", monthlyTarget: D(400) }], fixedExpenses: [], transactions: [],
  });
  assert.equal(s.freeMoney, "-300.00");
  assert.equal(s.projection.status, "DEFICIT");
});
