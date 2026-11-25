import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { HttpError, respond } from "@/lib/http";
import { createTransaction } from "@/services/transactionService";

export const POST = (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
  respond(async () => {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const fx = await prisma.fixedExpense.findFirst({ where: { id, userId } });
    if (!fx) throw new HttpError(404, "Gasto fijo no encontrado");
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const already = await prisma.transaction.count({
      where: { userId, fixedExpenseId: id, date: { gte: new Date(Date.UTC(y, m, 1)), lt: new Date(Date.UTC(y, m + 1, 1)) } },
    });
    if (already) throw new HttpError(409, "Ya está pagado este mes");
    return createTransaction(userId, {
      type: "EXPENSE", amount: fx.amount, date: new Date(Date.UTC(y, m, now.getUTCDate(), 12)),
      category: fx.category, description: fx.name, isHistorical: false,
      bankAccountId: fx.bankAccountId, creditCardId: fx.creditCardId, fixedExpenseId: fx.id,
    });
  }, 201);
