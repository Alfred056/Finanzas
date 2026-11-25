import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Body, HttpError, respond } from "@/lib/http";
import { createTransaction, parseTransaction } from "@/services/transactionService";

/** CSV simple con cabecera (type,amount,date,category,description,bankAccountId,creditCardId); soporta comillas. */
function parseCsv(text: string): Body[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === "," || c === ";") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);

  const [header, ...data] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return data.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

/** Importación: por defecto `isHistorical: true` (no altera saldos); con `?historical=false` afecta saldos. Acepta JSON ([...] o {transactions:[...]}) o CSV. */
export const POST = (req: Request) =>
  respond(async () => {
    const userId = await requireUserId();
    const historical = new URL(req.url).searchParams.get("historical") !== "false";
    const isCsv = (req.headers.get("content-type") ?? "").includes("csv");
    let rows: unknown;
    if (isCsv) rows = parseCsv(await req.text());
    else {
      const j: unknown = await req.json();
      rows = Array.isArray(j) ? j : (j as { transactions?: unknown })?.transactions;
    }
    if (!Array.isArray(rows) || rows.length === 0) throw new HttpError(400, "Se esperaba un arreglo de transacciones");
    if (rows.length > 10_000) throw new HttpError(400, "Máximo 10000 filas por importación");

    const errors: { row: number; error: string }[] = [];
    const data: ReturnType<typeof parseTransaction>[] = [];
    rows.forEach((r, i) => {
      try {
        if (!r || typeof r !== "object") throw new HttpError(400, "Fila inválida");
        data.push({ ...parseTransaction(r as Body), isHistorical: historical });
      } catch (e) {
        errors.push({ row: i + 1, error: e instanceof Error ? e.message : "Error" });
      }
    });
    if (errors.length) throw new HttpError(400, `Filas inválidas: ${JSON.stringify(errors.slice(0, 20))}`);

    if (!historical) {
      for (const tx of data) await createTransaction(userId, tx);
      return { imported: data.length };
    }
    const ids = (f: "bankAccountId" | "creditCardId") => [...new Set(data.map((t) => t[f]).filter((x): x is string => !!x))];
    const accIds = ids("bankAccountId");
    const cardIds = ids("creditCardId");
    if (accIds.length && (await prisma.bankAccount.count({ where: { userId, id: { in: accIds } } })) !== accIds.length)
      throw new HttpError(404, "Cuenta no encontrada");
    if (cardIds.length && (await prisma.creditCard.count({ where: { userId, id: { in: cardIds } } })) !== cardIds.length)
      throw new HttpError(404, "Tarjeta no encontrada");
    const res = await prisma.transaction.createMany({ data: data.map((t) => ({ ...t, userId })) });
    return { imported: res.count };
  }, 201);
