import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { oneOf, readBody, respond, str, HttpError } from "@/lib/http";

const TYPES = ["EXPENSE", "INCOME", "BOTH"] as const;
const BASE = [
  ["Comida", "EXPENSE"], ["Transporte", "EXPENSE"], ["Servicios", "EXPENSE"],
  ["Ocio", "EXPENSE"], ["Salud", "EXPENSE"], ["Sueldo", "INCOME"],
] as const;

export const GET = () =>
  respond(async () => {
    const userId = await requireUserId();
    if ((await prisma.category.count({ where: { userId } })) === 0)
      for (const [name, type] of BASE)
        await prisma.category.upsert({ where: { userId_name: { userId, name } }, update: {}, create: { userId, name, type } });
    return prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } });
  });

export const POST = (req: Request) =>
  respond(async () => {
    const userId = await requireUserId();
    const b = await readBody(req);
    const name = str(b, "name");
    if (await prisma.category.findUnique({ where: { userId_name: { userId, name } } })) throw new HttpError(409, "La categoría ya existe");
    return prisma.category.create({ data: { userId, name, type: oneOf(b, "type", TYPES, "BOTH") } });
  }, 201);
