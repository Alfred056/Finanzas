import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dec, int, readBody, respond, str } from "@/lib/http";

export const GET = () => respond(async () => prisma.creditCard.findMany({ where: { userId: await requireUserId() } }));

export const POST = (req: Request) =>
  respond(async () => {
    const userId = await requireUserId();
    const b = await readBody(req);
    return prisma.creditCard.create({
      data: {
        userId,
        bankName: str(b, "bankName"),
        cardName: str(b, "cardName"),
        creditLimit: dec(b, "creditLimit", { positive: true }),
        cutoffDay: int(b, "cutoffDay", 1, 31),
        paymentDueDay: int(b, "paymentDueDay", 1, 31),
      },
    });
  }, 201);
