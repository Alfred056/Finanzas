"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, shortDate, type Account, type Card, type Category, type Tx } from "@/lib/api";
import { signedAmount, TYPE_LABEL } from "./txFormat";

/** Modal nativo: foco atrapado, Escape para cerrar y fondo oscurecido. */
function Modal({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref} aria-label={title}
      onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }}
      // El evento `close` es asíncrono: se ignora si el diálogo ya se reabrió (doble efecto en desarrollo).
      onClose={(e) => { if (!e.currentTarget.open) onClose(); }}
      className="key-card m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-md overflow-y-auto text-mist backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <h2 className="mb-4 text-base font-medium text-white">{title}</h2>
      {children}
    </dialog>
  );
}

/** Ejecuta una escritura; si tiene éxito refresca la app y cierra el modal. */
function useSubmit(onDone: () => void, onClose: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(request: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await request();
      onDone();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return { busy, error, run };
}

interface DialogProps { tx: Tx; onClose: () => void; onDone: () => void }

export function EditTxDialog({ tx, accounts, cards, categories, onClose, onDone }: DialogProps & { accounts: Account[]; cards: Card[]; categories: Category[] }) {
  const { busy, error, run } = useSubmit(onDone, onClose);
  const originalDate = tx.date.slice(0, 10);
  const [form, setForm] = useState({
    type: tx.type as string,
    amount: tx.amount,
    date: originalDate,
    category: tx.category,
    description: tx.description,
    bankAccountId: tx.bankAccountId ?? "",
    creditCardId: tx.creditCardId ?? "",
  });
  const bind = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value })),
    className: "input-well",
  });
  // Incluye la categoría actual aunque no esté en la lista del usuario.
  const categoryNames = [...new Set(["Sin categoría", tx.category, ...categories.map((c) => c.name)])];

  function save(e: FormEvent) {
    e.preventDefault();
    // Si la fecha no cambió, se conserva la hora original.
    const date = form.date === originalDate ? tx.date : `${form.date}T12:00:00Z`;
    void run(() =>
      api(`/api/transactions/${tx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, date }),
      }),
    );
  }

  const label = "min-w-0 space-y-1 text-xs text-zinc-400";
  return (
    <Modal title="Editar movimiento" busy={busy} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <label className={label}>Tipo
            <select {...bind("type")}>{Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label className={label}>Monto
            <input type="number" step="any" min="0" required {...bind("amount")} />
          </label>
          <label className={label}>Fecha
            <input type="date" required {...bind("date")} />
          </label>
          <label className={label}>Categoría
            <select {...bind("category")}>{categoryNames.map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </label>
          <label className={`col-span-2 ${label}`}>Descripción
            <input {...bind("description")} />
          </label>
          <label className={label}>Cuenta
            <select {...bind("bankAccountId")}>
              <option value="">—</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.bankName} {a.accountName}</option>)}
            </select>
          </label>
          <label className={label}>Tarjeta
            <select {...bind("creditCardId")}>
              <option value="">—</option>
              {cards.map((c) => <option key={c.id} value={c.id}>{c.bankName} {c.cardName}</option>)}
            </select>
          </label>
        </div>
        {tx.isHistorical && <p className="text-xs text-zinc-500">Movimiento histórico: no altera saldos de cuentas.</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">Cancelar</button>
          <button disabled={busy} className="btn-primary">{busy ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function DeleteTxDialog({ tx, onClose, onDone }: DialogProps) {
  const { busy, error, run } = useSubmit(onDone, onClose);
  return (
    <Modal title="¿Estás seguro?" busy={busy} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-zinc-400">Se eliminará este movimiento:</p>
        <div className="rounded-lg bg-obsidian p-3">
          <p className="break-words text-sm text-white">{tx.description || tx.category}</p>
          <p className="mt-1 text-xs text-zinc-400">{shortDate(tx.date)} · {TYPE_LABEL[tx.type]}</p>
          <p className="mt-2 text-lg font-semibold tabular-nums text-white">{signedAmount(tx)}</p>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          {/* "No" recibe el foco inicial para evitar borrados accidentales. */}
          <button type="button" autoFocus onClick={onClose} disabled={busy} className="btn-ghost">No</button>
          <button
            type="button" disabled={busy} className="btn-primary"
            onClick={() => void run(() => api(`/api/transactions/${tx.id}`, { method: "DELETE" }))}
          >
            {busy ? "Eliminando…" : "OK"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
