import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { Body, date, dec, HttpError, oneOf, str } from "@/lib/http";

export const TX_TYPES = ["INCOME", "EXPENSE", "CARD_PAYMENT", "LOAN_PAYMENT"] as const;

export function parseTransaction(b: Body) {
  return {
    type: oneOf(b, "type", TX_TYPES),
    amount: dec(b, "amount", { positive: true }),
    date: date(b.date),
    category: str(b, "category", true) || "Sin categoría",
    description: str(b, "description", true),
    isHistorical: b.isHistorical === true || b.isHistorical === "true",
    bankAccountId: str(b, "bankAccountId", true) || null,
    creditCardId: str(b, "creditCardId", true) || null,
    fixedExpenseId: null as string | null,
  };
}

export type ParsedTx = ReturnType<typeof parseTransaction>;

/** Efecto sobre el saldo de la cuenta (INCOME suma; resto resta). Históricos o sin cuenta no afectan. */
function balanceEffect(tx: Pick<ParsedTx, "type" | "amount" | "isHistorical" | "bankAccountId">) {
  if (tx.isHistorical || !tx.bankAccountId) return null;
  return { accountId: tx.bankAccountId, delta: tx.type === "INCOME" ? tx.amount : tx.amount.neg() };
}

async function adjustBalance(db: Prisma.TransactionClient, effect: ReturnType<typeof balanceEffect>, revert = false) {
  if (!effect) return;
  await db.bankAccount.update({
    where: { id: effect.accountId },
    data: { balance: { increment: revert ? effect.delta.neg() : effect.delta } },
  });
}

/** Valida reglas del movimiento y que cuenta/tarjeta pertenezcan al usuario. */
async function assertValid(db: Prisma.TransactionClient, userId: string, tx: ParsedTx) {
  if (tx.type === "CARD_PAYMENT" && !tx.creditCardId) throw new HttpError(400, "CARD_PAYMENT requiere creditCardId");
  if (tx.bankAccountId && !(await db.bankAccount.findFirst({ where: { id: tx.bankAccountId, userId } })))
    throw new HttpError(404, "Cuenta no encontrada");
  if (tx.creditCardId && !(await db.creditCard.findFirst({ where: { id: tx.creditCardId, userId } })))
    throw new HttpError(404, "Tarjeta no encontrada");
}

async function findOwned(db: Prisma.TransactionClient, userId: string, id: string) {
  const found = await db.transaction.findFirst({ where: { id, userId } });
  if (!found) throw new HttpError(404, "Movimiento no encontrado");
  return found;
}

/** Registra el movimiento y ajusta el saldo de la cuenta. */
export async function createTransaction(userId: string, tx: ParsedTx) {
  return prisma.$transaction(async (db) => {
    await assertValid(db, userId, tx);
    const created = await db.transaction.create({ data: { ...tx, userId } });
    await adjustBalance(db, balanceEffect(tx));
    return created;
  });
}

/**
 * Actualiza un movimiento: revierte el efecto anterior y aplica el nuevo en una sola transacción.
 * Los campos ausentes en `changes` se conservan; `isHistorical` no es editable.
 */
export async function updateTransaction(userId: string, id: string, changes: Body) {
  return prisma.$transaction(async (db) => {
    const old = await findOwned(db, userId, id);
    const tx = parseTransaction({ ...old, amount: old.amount.toString(), date: old.date.toISOString(), ...changes });
    tx.isHistorical = old.isHistorical;
    // Solo un gasto puede seguir contando como pago de un gasto fijo.
    tx.fixedExpenseId = tx.type === "EXPENSE" ? old.fixedExpenseId : null;
    await assertValid(db, userId, tx);

    await adjustBalance(db, balanceEffect(old), true);
    const updated = await db.transaction.update({ where: { id }, data: tx });
    await adjustBalance(db, balanceEffect(tx));
    return updated;
  });
}

/** Elimina un movimiento revirtiendo su efecto en el saldo. La deuda de tarjetas se deriva de los movimientos. */
export async function deleteTransaction(userId: string, id: string) {
  return prisma.$transaction(async (db) => {
    const old = await findOwned(db, userId, id);
    await adjustBalance(db, balanceEffect(old), true);
    await db.transaction.delete({ where: { id } });
    return { id };
  });
}
