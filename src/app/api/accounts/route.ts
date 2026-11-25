import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dec, oneOf, readBody, respond, str } from "@/lib/http";

export const GET = () => respond(async () => prisma.bankAccount.findMany({ where: { userId: await requireUserId() }, orderBy: { createdAt: "asc" } }));

export const POST = (req: Request) =>
  respond(async () => {
    const userId = await requireUserId();
    const b = await readBody(req);
    return prisma.bankAccount.create({
      data: {
        userId,
        bankName: str(b, "bankName"),
        accountName: str(b, "accountName"),
        currency: oneOf(b, "currency", ["PEN", "USD"] as const, "PEN"),
        balance: dec(b, "balance", { optional: true }),
      },
    });
  }, 201);
