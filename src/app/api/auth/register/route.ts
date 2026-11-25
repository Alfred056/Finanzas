import { prisma } from "@/lib/db";
import { hashPassword, setSession } from "@/lib/auth";
import { HttpError, readBody, respond, str } from "@/lib/http";

export const POST = (req: Request) =>
  respond(async () => {
    const b = await readBody(req);
    const username = str(b, "username").toLowerCase();
    const password = str(b, "password");
    const displayName = str(b, "displayName");
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new HttpError(400, "Usuario: 3-32 caracteres (letras, números, . _ -)");
    if (password.length < 6) throw new HttpError(400, "La contraseña debe tener al menos 6 caracteres");
    if (await prisma.user.findUnique({ where: { username } })) throw new HttpError(409, "El usuario ya existe");
    const user = await prisma.user.create({ data: { username, passwordHash: hashPassword(password), displayName } });
    await setSession(user.id);
    return { id: user.id, username: user.username, displayName: user.displayName };
  }, 201);
