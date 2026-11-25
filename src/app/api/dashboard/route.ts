import { requireUserId } from "@/lib/auth";
import { getMonthlyCashflowSummary } from "@/services/financeEngine";
import { HttpError, respond } from "@/lib/http";

export const GET = (req: Request) =>
  respond(async () => {
    const userId = await requireUserId();
    const q = new URL(req.url).searchParams;
    const now = new Date();
    const month = Number(q.get("month") ?? now.getMonth() + 1);
    const year = Number(q.get("year") ?? now.getFullYear());
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new HttpError(400, "month debe ser 1-12");
    if (!Number.isInteger(year) || year < 1970 || year > 2200) throw new HttpError(400, "year inválido");
    return getMonthlyCashflowSummary(month, year, userId);
  });
