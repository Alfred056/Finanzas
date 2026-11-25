import { clearSession } from "@/lib/auth";
import { respond } from "@/lib/http";

export const POST = () => respond(async () => { await clearSession(); return { ok: true }; });
