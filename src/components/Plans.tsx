"use client";
import { PiggyBank, Sparkles } from "lucide-react";
import { money, useApi, type Plan, type Summary } from "@/lib/api";
import { Bar, Empty, Panel, QuickForm } from "./ui";
import type { ViewProps } from "./AppShell";

export function Plans({ month, year, version, refresh }: ViewProps) {
  const plans = useApi<Plan[]>("/api/plans", version).data;
  const summary = useApi<Summary>(`/api/dashboard?month=${month}&year=${year}`, version).data;

  // Disponible para metas = banco − tarjetas − cuotas; se asigna primero a ahorro y luego a gustos.
  let pool = summary ? Math.max(0, Number(summary.bankTotal) - Number(summary.cardsDue) - Number(summary.loansDue)) : 0;
  const ordered = [...(plans ?? [])].sort((a, b) => (a.type === b.type ? 0 : a.type === "SAVINGS" ? -1 : 1));
  const funded = new Map<string, number>();
  for (const p of ordered) {
    const got = Math.min(pool, Number(p.monthlyTarget));
    funded.set(p.id, got);
    pool -= got;
  }

  const group = (type: Plan["type"], title: string, icon: React.ReactNode, color: string) => {
    const list = (plans ?? []).filter((p) => p.type === type);
    return (
      <Panel title={title} icon={icon}>
        {list.length === 0 && <Empty>Sin metas.</Empty>}
        <div className="space-y-4">
          {list.map((p) => {
            const got = funded.get(p.id) ?? 0;
            return (
              <div key={p.id}>
                <div className="flex justify-between gap-3 text-sm"><span className="min-w-0 break-words">{p.name}</span><span className="tabular-nums">{money(got)} / {money(p.monthlyTarget)}</span></div>
                <Bar pct={(got / Number(p.monthlyTarget)) * 100} color={color} />
              </div>
            );
          })}
        </div>
      </Panel>
    );
  };

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="min-w-0 space-y-4 lg:col-span-2">
        {group("SAVINGS", "Ahorro", <PiggyBank size={15} />, "bg-emerald-500")}
        {group("WANTS", "Gustos", <Sparkles size={15} />, "bg-violet-500")}
        <p className="text-xs text-zinc-500">Disponible = dinero en bancos − tarjetas y cuotas del mes, asignado primero a ahorro y luego a gustos.</p>
      </div>
      <Panel>
        <QuickForm
          title="Nueva meta mensual" endpoint="/api/plans" onDone={refresh}
          fields={[
            { name: "name", label: "Nombre" },
            { name: "type", label: "Tipo", type: "select", initial: "SAVINGS", options: [["SAVINGS", "Ahorro"], ["WANTS", "Gustos"]] },
            { name: "monthlyTarget", label: "Objetivo mensual", type: "number" },
          ]}
        />
      </Panel>
    </div>
  );
}
