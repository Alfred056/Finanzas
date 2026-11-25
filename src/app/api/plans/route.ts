import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dec, oneOf, readBody, respond, str } from "@/lib/http";

export const GET = () => respond(async () => prisma.monthlyPlan.findMany({ where: { userId: await requireUserId() } }));

export const POST = (req: Request) =>
  respond(async () => {
    const userId = await requireUserId();
    const b = await readBody(req);
    return prisma.monthlyPlan.create({
      data: {
        userId,
        name: str(b, "name"),
        type: oneOf(b, "type", ["SAVINGS", "WANTS"] as const),
        monthlyTarget: dec(b, "monthlyTarget", { positive: true }),
      },
    });
  }, 201);
