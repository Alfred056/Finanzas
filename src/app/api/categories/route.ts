import { defaultColorFor, isHexColor } from "@/domain/categoryColors";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { oneOf, readBody, respond, str, HttpError } from "@/lib/http";
import { listCategories } from "@/services/categoryService";

const TYPES = ["EXPENSE", "INCOME", "BOTH"] as const;

export const GET = () => respond(async () => listCategories(await requireUserId()));

export const POST = (req: Request) =>
  respond(async () => {
    const userId = await requireUserId();
    const b = await readBody(req);
    const name = str(b, "name");
    const color = (str(b, "color", true) || defaultColorFor(name)).toLowerCase();
    if (!isHexColor(color)) throw new HttpError(400, "Campo 'color' debe tener formato #rrggbb");
    if (await prisma.category.findUnique({ where: { userId_name: { userId, name } } })) throw new HttpError(409, "La categoría ya existe");
    return prisma.category.create({ data: { userId, name, color, type: oneOf(b, "type", TYPES, "BOTH") } });
  }, 201);
