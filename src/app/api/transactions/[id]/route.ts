import { requireUserId } from "@/lib/auth";
import { readBody, respond } from "@/lib/http";
import { deleteTransaction, updateTransaction } from "@/services/transactionService";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = (req: Request, ctx: Ctx) =>
  respond(async () => {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    return updateTransaction(userId, id, await readBody(req));
  });

export const DELETE = (_req: Request, ctx: Ctx) =>
  respond(async () => {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    return deleteTransaction(userId, id);
  });
