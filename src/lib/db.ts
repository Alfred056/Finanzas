import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

const create = () =>
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
  });

// En dev, un cliente cacheado antes de un `prisma generate` carece de los modelos nuevos: se recrea.
const stale = (c?: PrismaClient) => !c || !("category" in c) || !("fixedExpense" in c);

export const prisma = stale(g.prisma) ? create() : g.prisma!;

if (process.env.NODE_ENV !== "production") g.prisma = prisma;
