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

/** Registra el movimiento y, si no es histórico, ajusta el saldo de la cuenta (INCOME suma; resto resta). */
export async function createTransaction(userId: string, tx: ParsedTx) {
  if (tx.type === "CARD_PAYMENT" && !tx.creditCardId) throw new HttpError(400, "CARD_PAYMENT requiere creditCardId");
  return prisma.$transaction(async (db) => {
    if (tx.bankAccountId && !(await db.bankAccount.findFirst({ where: { id: tx.bankAccountId, userId } })))
      throw new HttpError(404, "Cuenta no encontrada");
    if (tx.creditCardId && !(await db.creditCard.findFirst({ where: { id: tx.creditCardId, userId } })))
      throw new HttpError(404, "Tarjeta no encontrada");

    const created = await db.transaction.create({ data: { ...tx, userId } });
    if (!tx.isHistorical && tx.bankAccountId) {
      const delta = tx.type === "INCOME" ? tx.amount : tx.amount.neg();
      await db.bankAccount.update({
        where: { id: tx.bankAccountId },
        data: { balance: { increment: new Prisma.Decimal(delta) } },
      });
    }
    return created;
  });
}
