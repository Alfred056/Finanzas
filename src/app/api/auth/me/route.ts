import { getSessionUser, } from "@/lib/auth";
import { respond } from "@/lib/http";

export const GET = () => respond(async () => ({ user: await getSessionUser() }));
