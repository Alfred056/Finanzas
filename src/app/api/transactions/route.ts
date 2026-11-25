import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { HttpError, readBody, respond } from "@/lib/http";
import { createTransaction, parseTransaction } from "@/services/transactionService";

export const GET = (req: Request) =>
  respond(async () => {
    const userId = await requireUserId();
    const q = new URL(req.url).searchParams;
    const month = q.get("month") ? Number(q.get("month")) : null;
    const year = q.get("year") ? Number(q.get("year")) : null;
    if ((month !== null && !(month >= 1 && month <= 12)) || (month !== null && year === null))
      throw new HttpError(400, "month (1-12) requiere year");
    const range =
      year === null
        ? undefined
        : month === null
          ? { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) }
          : { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };
    return prisma.transaction.findMany({
      where: {
        userId,
        date: range,
        bankAccountId: q.get("accountId") ?? undefined,
        creditCardId: q.get("cardId") ?? undefined,
      },
      orderBy: { date: "desc" },
      take: Math.min(Number(q.get("limit") ?? 200) || 200, 1000),
    });
  });

export const POST = (req: Request) =>
  respond(async () => createTransaction(await requireUserId(), parseTransaction(await readBody(req))), 201);
