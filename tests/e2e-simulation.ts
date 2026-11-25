/**
 * Simulación E2E: un mes (noviembre 2026) de un usuario real contra los endpoints HTTP reales.
 * Requiere el servidor en marcha (BASE_URL, por defecto http://localhost:3000) y la fecha del sistema en nov-2026
 * (el endpoint "pagar gasto fijo" usa la fecha actual). Limpia al terminar, pase o falle.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const USERNAME = "test_user_e2e";
const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }) });
let cookie = "";
let checks = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = res.headers.getSetCookie?.()[0];
  if (sc) cookie = sc.split(";")[0];
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return data as T;
}

/** Igualdad numérica exacta con Decimal. */
function eq(actual: string | number, expected: string, label: string) {
  assert.ok(new Prisma.Decimal(actual).eq(expected), `${label}: esperado ${expected}, obtenido ${actual}`);
  checks++;
  console.log(`  ✔ ${label} = ${expected}`);
}

async function cleanup() {
  const u = await db.user.findUnique({ where: { username: USERNAME } });
  if (!u) return false;
  const where = { userId: u.id };
  await db.transaction.deleteMany({ where });
  await db.fixedExpense.deleteMany({ where });
  await db.bankAccount.deleteMany({ where });
  await db.creditCard.deleteMany({ where });
  await db.loan.deleteMany({ where });
  await db.monthlyPlan.deleteMany({ where });
  await db.category.deleteMany({ where });
  await db.user.delete({ where: { id: u.id } });
  return true;
}

async function main() {
  const now = new Date();
  assert.ok(now.getUTCFullYear() === 2026 && now.getUTCMonth() === 10, "El E2E requiere que la fecha del sistema sea noviembre 2026");
  await cleanup(); // restos de una corrida anterior

  console.log("Registro");
  await call("POST", "/api/auth/register", { username: USERNAME, password: "clave123", displayName: "Tester" });
  const me = await call("GET", "/api/auth/me");
  assert.equal(me.user.username, USERNAME);

  console.log("Setup");
  const bcp = await call("POST", "/api/accounts", { bankName: "BCP", accountName: "Sueldo", balance: 500 });
  const ibk = await call("POST", "/api/accounts", { bankName: "Interbank", accountName: "Ahorros", balance: 1200 });
  const card = await call("POST", "/api/cards", { bankName: "BBVA", cardName: "Visa", creditLimit: 3000, cutoffDay: 15, paymentDueDay: 10 });
  await call("POST", "/api/loans", {
    lenderName: "Banco", principalAmount: 6000, annualInterestRate: 18, totalInstallments: 12, paidInstallments: 0,
    monthlyPayment: 550.08, paymentDay: 5,
  });
  const internet = await call("POST", "/api/fixed-expenses", { name: "Internet", amount: 120, dueDay: 5, category: "Servicios", bankAccountId: bcp.id });
  await call("POST", "/api/fixed-expenses", { name: "Gimnasio", amount: 99.9, dueDay: 8, category: "Salud", bankAccountId: bcp.id });
  await call("POST", "/api/plans", { name: "Fondo emergencia", type: "SAVINGS", monthlyTarget: 400 });

  const tx = (type: string, amount: number, date: string, category: string, extra: object = {}) =>
    call("POST", "/api/transactions", { type, amount, date: `${date}T12:00:00Z`, category, description: category, ...extra });

  console.log("Ingresos");
  await tx("INCOME", 3500, "2026-11-01", "Sueldo", { bankAccountId: bcp.id });
  await tx("INCOME", 600, "2026-11-03", "Freelance", { bankAccountId: ibk.id });

  console.log("Gastos con débito");
  await tx("EXPENSE", 85, "2026-11-04", "Comida", { bankAccountId: bcp.id });
  await tx("EXPENSE", 60, "2026-11-06", "Transporte", { bankAccountId: bcp.id });
  await tx("EXPENSE", 110, "2026-11-09", "Salud", { bankAccountId: bcp.id });

  console.log("Compras con tarjeta");
  await tx("EXPENSE", 250, "2026-11-05", "Compras", { creditCardId: card.id });
  await tx("EXPENSE", 180, "2026-11-12", "Ocio", { creditCardId: card.id });
  await tx("EXPENSE", 300, "2026-11-20", "Compras", { creditCardId: card.id }); // post-corte
  await tx("CARD_PAYMENT", 200, "2026-11-21", "Pago tarjeta", { creditCardId: card.id, bankAccountId: bcp.id });

  console.log("Gasto fijo pagado (Internet)");
  await call("POST", `/api/fixed-expenses/${internet.id}/pay`);
  const fixed = await call<{ name: string; paidThisMonth: boolean }[]>("GET", "/api/fixed-expenses?month=11&year=2026");
  assert.equal(fixed.find((f) => f.name === "Internet")?.paidThisMonth, true);
  assert.equal(fixed.find((f) => f.name === "Gimnasio")?.paidThisMonth, false);
  checks += 2;
  console.log("  ✔ Internet pagado, Gimnasio pendiente");

  console.log("Saldos de cuentas");
  const bal = async (id: string) => (await call<{ id: string; balance: string }[]>("GET", "/api/accounts")).find((a) => a.id === id)!.balance;
  // BCP: 500 + 3500 − 85 − 60 − 110 − 200 (pago tarjeta) − 120 (Internet) = 3425
  eq(await bal(bcp.id), "3425", "BCP");
  eq(await bal(ibk.id), "1800", "Interbank"); // 1200 + 600

  console.log("Tarjeta y dashboard noviembre");
  let s = await call("GET", "/api/dashboard?month=11&year=2026");
  const c = s.cards[0];
  eq(c.used, "530", "usedAmount (250+180+300−200)");
  eq(c.available, "2470", "availableLimit");
  eq(c.billedThisMonth, "0", "Deuda exigible nov (estado cerrado 15-oct)");
  eq(c.nextMonthCharges, "730", "Consumos posteriores al corte del 15-oct");
  eq(s.cardsDue, "0", "cardsDue nov");
  eq(s.loansDue, "550.08", "Cuota préstamo pendiente");
  eq(s.fixedDue, "99.9", "Gastos fijos pendientes (Gimnasio)");
  eq(s.savingsBudget, "400", "Meta de ahorro");
  eq(s.income, "4100", "Ingresos del mes");
  eq(s.bankTotal, "5225", "Total bancos");
  // 5225 − 0 − 550.08 − 99.90 − 400
  eq(s.freeMoney, "4175.02", "Dinero Realmente Libre (antes de pagar cuota)");

  console.log("Dashboard diciembre (ciclo vs post-corte)");
  const dec = await call("GET", "/api/dashboard?month=12&year=2026");
  eq(dec.cards[0].billedThisMonth, "430", "Ciclo cerrado el 15-nov (250+180)");
  eq(dec.cards[0].dueThisMonth, "230", "Exigible 10-dic (430 − pago 200)");
  eq(dec.cards[0].nextMonthCharges, "300", "Post-corte (20-nov)");

  console.log("Pago de cuota de préstamo");
  await tx("LOAN_PAYMENT", 550.08, "2026-11-22", "Préstamo", { bankAccountId: bcp.id });
  s = await call("GET", "/api/dashboard?month=11&year=2026");
  eq(await bal(bcp.id), "2874.92", "BCP tras cuota");
  eq(s.loansDue, "0", "Cuota préstamo pendiente tras pago");
  eq(s.bankTotal, "4674.92", "Total bancos final");
  // 4674.92 − 0 − 0 − 99.90 − 400
  eq(s.freeMoney, "4175.02", "Dinero Realmente Libre final");

  console.log("Aislamiento");
  const saved = cookie;
  cookie = "";
  await assert.rejects(call("GET", "/api/accounts"), /401/);
  checks++;
  console.log("  ✔ sin sesión → 401");
  cookie = saved;

  console.log(`\n${checks} verificaciones OK`);
}

main()
  .then(() => { process.exitCode = 0; }, (e) => { console.error("\n✘ FALLÓ:", e.message ?? e); process.exitCode = 1; })
  .finally(async () => {
    const removed = await cleanup().catch((e) => { console.error("Error en limpieza:", e); process.exitCode = 1; return false; });
    const left = await db.user.count({ where: { username: USERNAME } });
    console.log(left === 0 ? `Limpieza: usuario ${USERNAME} y sus registros eliminados${removed ? "" : " (ya no existía)"}` : "Limpieza INCOMPLETA");
    await db.$disconnect();
  });
