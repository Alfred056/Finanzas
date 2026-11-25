import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Handler = () => Promise<unknown>;

/** Ejecuta un handler y mapea errores a JSON. */
export async function respond(fn: Handler, status = 200): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn(), { status });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof SyntaxError) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export type Body = Record<string, unknown>;

export async function readBody(req: Request): Promise<Body> {
  const b: unknown = await req.json();
  if (!b || typeof b !== "object" || Array.isArray(b)) throw new HttpError(400, "Body debe ser un objeto");
  return b as Body;
}

export const str = (b: Body, k: string, opt = false): string => {
  const v = b[k];
  if (typeof v === "string" && v.trim()) return v.trim();
  if (opt) return "";
  throw new HttpError(400, `Campo '${k}' requerido (string)`);
};

export const dec = (b: Body, k: string, opts: { positive?: boolean; optional?: boolean } = {}): Prisma.Decimal => {
  const v = b[k];
  if (v === undefined || v === null || v === "") {
    if (opts.optional) return new Prisma.Decimal(0);
    throw new HttpError(400, `Campo '${k}' requerido (número)`);
  }
  let d: Prisma.Decimal;
  try {
    d = new Prisma.Decimal(v as string | number);
  } catch {
    throw new HttpError(400, `Campo '${k}' no es un número válido`);
  }
  if (!d.isFinite()) throw new HttpError(400, `Campo '${k}' no es un número válido`);
  if (opts.positive && d.lte(0)) throw new HttpError(400, `Campo '${k}' debe ser > 0`);
  return d;
};

export const int = (b: Body, k: string, min: number, max: number, def?: number): number => {
  const v = b[k] ?? def;
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max)
    throw new HttpError(400, `Campo '${k}' debe ser entero entre ${min} y ${max}`);
  return v;
};

export const oneOf = <T extends string>(b: Body, k: string, values: readonly T[], def?: T): T => {
  const v = b[k] ?? def;
  if (typeof v !== "string" || !values.includes(v as T))
    throw new HttpError(400, `Campo '${k}' debe ser uno de: ${values.join(", ")}`);
  return v as T;
};

export const date = (v: unknown, k = "date"): Date => {
  const d = new Date(v as string);
  if (typeof v !== "string" || Number.isNaN(d.getTime())) throw new HttpError(400, `Campo '${k}' no es una fecha válida`);
  return d;
};
