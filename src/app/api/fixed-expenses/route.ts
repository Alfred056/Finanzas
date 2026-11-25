import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dec, HttpError, int, readBody, respond, str } from "@/lib/http";

export const GET = (req: Request) =>
  respond(async () => {
    const userId = await requireUserId();
    const q = new URL(req.url).searchParams;
    const month = Number(q.get("month") ?? new Date().getUTCMonth() + 1);
    const year = Number(q.get("year") ?? new Date().getUTCFullYear());
    const items = await prisma.fixedExpense.findMany({ where: { userId }, orderBy: { dueDay: "asc" } });
    const paid = await prisma.transaction.findMany({
      where: {
        userId,
        fixedExpenseId: { in: items.map((i) => i.id) },
        date: { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) },
      },
      select: { fixedExpenseId: true },
    });
    const paidIds = new Set(paid.map((p) => p.fixedExpenseId));
    return items.map((i) => ({ ...i, paidThisMonth: paidIds.has(i.id) }));
  });

export const POST = (req: Request) =>
  respond(async () => {
    const userId = await requireUserId();
    const b = await readBody(req);
    const bankAccountId = str(b, "bankAccountId", true) || null;
    const creditCardId = str(b, "creditCardId", true) || null;
    if (bankAccountId && !(await prisma.bankAccount.findFirst({ where: { id: bankAccountId, userId } })))
      throw new HttpError(404, "Cuenta no encontrada");
    if (creditCardId && !(await prisma.creditCard.findFirst({ where: { id: creditCardId, userId } })))
      throw new HttpError(404, "Tarjeta no encontrada");
    return prisma.fixedExpense.create({
      data: {
        userId,
        name: str(b, "name"),
        amount: dec(b, "amount", { positive: true }),
        dueDay: int(b, "dueDay", 1, 31),
        category: str(b, "category", true) || "Servicios",
        bankAccountId,
        creditCardId,
        active: b.active !== false,
      },
    });
  }, 201);

export const DELETE = (req: Request) =>
  respond(async () => {
    const userId = await requireUserId();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new HttpError(400, "Parámetro 'id' requerido");
    await prisma.fixedExpense.delete({ where: { id, userId } }).catch(() => {
      throw new HttpError(404, "Gasto fijo no encontrado");
    });
    return { deleted: id };
  });
