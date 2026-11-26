import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient; prismaSchema?: string };

const create = () =>
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
  });

// Huella de modelos y campos del cliente generado: en dev, un cliente cacheado antes de un
// `prisma generate` no conoce los cambios (ej. un campo nuevo) y debe recrearse.
const schema = JSON.stringify(Object.entries(Prisma).filter(([name]) => name.endsWith("ScalarFieldEnum")));

export const prisma = g.prisma && g.prismaSchema === schema ? g.prisma : create();

if (process.env.NODE_ENV !== "production") {
  g.prisma = prisma;
  g.prismaSchema = schema;
}
