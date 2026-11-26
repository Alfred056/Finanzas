"use client";
import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { post } from "@/lib/api";
import { ColorPicker } from "./CategoryColor";

export function Panel({ title, icon, children, className = "" }: { title?: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`key-card key-card-sm w-full min-w-0 max-w-full ${className}`}>
      {title && (
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-200">
          {icon}
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function Bar({ pct, color = "bg-emerald-500", fill }: { pct: number; color?: string; /** Color CSS libre; reemplaza a `color`. */ fill?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-obsidian shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
      <div className={`h-full rounded-full ${fill ? "" : color}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: fill }} />
    </div>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="text-sm text-zinc-500">{children}</p>;

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "color";
  options?: [string, string][];
  step?: string;
  initial?: string;
  required?: boolean;
  /** Contenido extra junto al input (ej. botón "+"). */
  adornment?: ReactNode;
}

const inputCls =
  "input-well";

/** Formulario genérico: envía los campos (números como Number, vacíos omitidos) a `endpoint` por POST. */
export function QuickForm({ title, endpoint, fields, onDone }: { title: string; endpoint: string; fields: FieldDef[]; onDone: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body: Record<string, unknown> = {};
    for (const f of fields) {
      const v = String(fd.get(f.name) ?? "").trim();
      if (!v) continue;
      body[f.name] = f.type === "number" ? Number(v) : f.type === "date" ? `${v}T12:00:00Z` : v;
    }
    setBusy(true);
    setError("");
    try {
      await post(endpoint, body);
      form.reset();
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full min-w-0 space-y-3">
      <h3 className="text-sm font-medium text-white">{title}</h3>
      <div className="grid grid-cols-2 gap-2">
        {fields.map((f) => f.type === "color" ? <ColorPicker key={f.name} name={f.name} label={f.label} /> : (
          <label key={f.name} className="min-w-0 space-y-1 text-xs text-zinc-400">
            {f.label}
            {f.type === "select" ? (
              <span className="flex min-w-0 gap-1">
                <select name={f.name} defaultValue={f.initial ?? ""} required={f.required} className={inputCls}>
                  {f.options?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {f.adornment}
              </span>
            ) : (
              <input
                name={f.name}
                type={f.type ?? "text"}
                step={f.type === "number" ? (f.step ?? "any") : undefined}
                defaultValue={f.initial}
                required={f.required ?? true}
                className={inputCls}
              />
            )}
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        disabled={busy}
        className="btn-primary"
      >
        <Plus size={14} /> {busy ? "Guardando…" : "Agregar"}
      </button>
    </form>
  );
}
