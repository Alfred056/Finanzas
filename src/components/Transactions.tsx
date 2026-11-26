"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { api, post, shortDate, useApi, type Account, type Card, type Category, type Tx } from "@/lib/api";
import { Empty, Panel, QuickForm } from "./ui";
import { DeleteTxDialog, EditTxDialog } from "./TransactionDialogs";
import { signedAmount, TYPE_LABEL } from "./txFormat";
import { CategoryBadge } from "./CategoryColor";
import type { ViewProps } from "./AppShell";

const SAMPLE = "type,amount,date,category,description,bankAccountId,creditCardId\nEXPENSE,45.50,2026-01-15,Comida,Almuerzo,,";

function ImportBox({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [historical, setHistorical] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    const isJson = /^\s*[[{]/.test(text);
    try {
      const r = await api<{ imported: number }>(`/api/transactions/import?historical=${historical}`, {
        method: "POST",
        headers: { "Content-Type": isJson ? "application/json" : "text/csv" },
        body: text,
      });
      setMsg({ ok: true, text: `${r.imported} movimientos importados.` });
      setText("");
      onDone();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-200">Importar movimientos (CSV / JSON)</h3>
      <input
        type="file" accept=".csv,.json,text/csv,application/json"
        onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }}
        className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-zinc-200"
      />
      <textarea
        value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={SAMPLE}
        className="input-well font-mono !text-xs"
      />
      <label className="flex items-center gap-2 text-xs text-zinc-300">
        <input type="checkbox" checked={historical} onChange={(e) => setHistorical(e.target.checked)} />
        Marcar como histórico (no altera saldos actuales)
      </label>
      {msg && <p className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
      <button
        onClick={send} disabled={!text.trim()}
        className="btn-primary"
      >
        <Upload size={14} /> Importar
      </button>
    </div>
  );
}

function CategoryAdder({ onCreated }: { onCreated: (c: Category) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  async function save() {
    if (!name.trim()) return;
    try {
      onCreated(await post<Category>("/api/categories", { name, type: "BOTH" }));
      setName(""); setOpen(false); setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (!open)
    return (
      <button type="button" aria-label="Nueva categoría" onClick={() => setOpen(true)} className="btn-ghost !px-2">
        <Plus size={14} />
      </button>
    );
  return (
    <span className="flex gap-1">
      <input
        autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva…" title={err}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void save(); } if (e.key === "Escape") setOpen(false); }}
        className={`input-well !w-24 !px-2 ${err ? "is-error" : ""}`}
      />
      <button type="button" onClick={save} className="btn-primary !px-2 !text-xs">OK</button>
    </span>
  );
}

export function Transactions({ month, year, version, refresh, today }: ViewProps) {
  const txs = useApi<Tx[]>(`/api/transactions?month=${month}&year=${year}`, version).data;
  const accounts = useApi<Account[]>("/api/accounts", version).data ?? [];
  const cards = useApi<Card[]>("/api/cards", version).data ?? [];
  const fetched = useApi<Category[]>("/api/categories", version).data ?? [];
  const [added, setAdded] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [deleting, setDeleting] = useState<Tx | null>(null);
  const categories = [...fetched, ...added.filter((a) => !fetched.some((c) => c.id === a.id))];

  function onCategoryCreated(c: Category) {
    setAdded((a) => [...a, c]);
    // Selecciona la nueva categoría una vez renderizada la opción.
    requestAnimationFrame(() => {
      const sel = document.querySelector<HTMLSelectElement>('select[name="category"]');
      if (sel) sel.value = c.name;
    });
  }

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="min-w-0 space-y-4 lg:order-first lg:sticky lg:top-32 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto lg:self-start">
        <Panel>
          <QuickForm
            title="Registrar movimiento" endpoint="/api/transactions" onDone={refresh}
            fields={[
              { name: "type", label: "Tipo", type: "select", initial: "EXPENSE", options: Object.entries(TYPE_LABEL) },
              { name: "amount", label: "Monto", type: "number" },
              { name: "date", label: "Fecha", type: "date", initial: today },
              {
                name: "category", label: "Categoría", type: "select", required: false,
                options: [["", "Sin categoría"], ...categories.map((c): [string, string] => [c.name, c.name])],
                adornment: <CategoryAdder onCreated={onCategoryCreated} />,
              },
              { name: "description", label: "Descripción", required: false },
              { name: "bankAccountId", label: "Cuenta", type: "select", required: false, options: [["", "—"], ...accounts.map((a): [string, string] => [a.id, `${a.bankName} ${a.accountName}`])] },
              { name: "creditCardId", label: "Tarjeta", type: "select", required: false, options: [["", "—"], ...cards.map((c): [string, string] => [c.id, `${c.bankName} ${c.cardName}`])] },
            ]}
          />
          <p className="mt-2 text-xs text-zinc-500">Gasto con tarjeta: elige tarjeta y deja la cuenta vacía. Pago de tarjeta: ambas.</p>
        </Panel>
        {/* Importar CSV/JSON oculto temporalmente */}
        {false && <Panel><ImportBox onDone={refresh} /></Panel>}
      </div>
      <Panel title="Movimientos del mes" className="lg:col-span-2">
        <div className="max-h-[520px] overflow-y-auto overflow-x-hidden pr-1">
        {txs?.length === 0 && <Empty>Sin movimientos en este mes.</Empty>}
        <div className="divide-y divide-zinc-800">
          {txs?.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-obsidian">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <CategoryBadge name={t.category} color={t.color} />
                  {t.description && <span className="min-w-0 max-w-full truncate text-zinc-200">{t.description}</span>}
                </span>
                <span className="mt-1 block font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                  {shortDate(t.date)} · {TYPE_LABEL[t.type]}{t.isHistorical && " · histórico"}
                </span>
              </span>
              <span className={`shrink-0 text-[15px] font-semibold tabular-nums ${t.type === "INCOME" ? "text-success-green" : "text-coral-pulse"}`}>
                {signedAmount(t)}
              </span>
              <span className="flex shrink-0 gap-1.5">
                <button type="button" aria-label="Editar movimiento" title="Editar" onClick={() => setEditing(t)} className="btn-ghost !p-1.5">
                  <Pencil size={14} />
                </button>
                <button type="button" aria-label="Eliminar movimiento" title="Eliminar" onClick={() => setDeleting(t)} className="btn-ghost !p-1.5">
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))}
        </div>
        </div>
      </Panel>

      {editing && (
        <EditTxDialog tx={editing} accounts={accounts} cards={cards} categories={categories} onClose={() => setEditing(null)} onDone={refresh} />
      )}
      {deleting && <DeleteTxDialog tx={deleting} onClose={() => setDeleting(null)} onDone={refresh} />}
    </div>
  );
}
