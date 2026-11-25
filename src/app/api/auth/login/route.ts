import { prisma } from "@/lib/db";
import { setSession, verifyPassword } from "@/lib/auth";
import { HttpError, readBody, respond, str } from "@/lib/http";

export const POST = (req: Request) =>
  respond(async () => {
    const b = await readBody(req);
    const user = await prisma.user.findUnique({ where: { username: str(b, "username").toLowerCase() } });
    if (!user || !verifyPassword(str(b, "password"), user.passwordHash)) throw new HttpError(401, "Usuario o contraseña incorrectos");
    await setSession(user.id);
    return { id: user.id, username: user.username, displayName: user.displayName };
  });
