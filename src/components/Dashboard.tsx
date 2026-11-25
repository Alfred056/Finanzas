"use client";
import { CreditCard, HandCoins, Landmark, TrendingDown, TrendingUp } from "lucide-react";
import { money, shortDate, useApi, type Summary } from "@/lib/api";
import { Bar, Empty, Panel } from "./ui";
import type { ViewProps } from "./AppShell";

function Kpi({ label, value, icon, tone = "text-white", accent }: { label: string; value: string; icon: React.ReactNode; tone?: string; accent: string }) {
  return (
    <section className="key-card key-card-sm kpi" style={{ "--kpi": accent } as React.CSSProperties}>
      <div className="flex items-center justify-between text-xs font-medium text-zinc-400">{label}<span className="text-zinc-500">{icon}</span></div>
      <p className={`kpi-value mt-3 ${tone}`}>{money(value)}</p>
    </section>
  );
}

export function Dashboard({ month, year, version }: ViewProps) {
  const { data: s, error } = useApi<Summary>(`/api/dashboard?month=${month}&year=${year}`, version);
  if (error) return <p className="text-red-400">{error}</p>;
  if (!s) return <p className="text-zinc-500">Cargando…</p>;

  const surplus = s.projection.status === "SURPLUS";
  const bars = [
    { label: "Ingresos", v: Number(s.income), color: "bg-emerald-500" },
    { label: "Gastos", v: Number(s.expenses), color: "bg-rose-500" },
    { label: "Compromisos", v: Number(s.commitments), color: "bg-amber-500" },
  ];
  const max = Math.max(...bars.map((b) => b.v), 1);

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="grid grid-cols-2 gap-3 *:min-w-0 lg:grid-cols-4">
        <Kpi label="Dinero en bancos" value={s.bankTotal} icon={<Landmark size={16} />} accent="#e6e6e6" />
        <Kpi label="Deuda tarjetas del mes" value={s.cardsDue} icon={<CreditCard size={16} />} tone="text-amber-400" accent="#9c9c9d" />
        <Kpi label="Cuotas préstamos del mes" value={s.loansDue} icon={<HandCoins size={16} />} tone="text-amber-400" accent="#6a6b6c" />
        <section style={{ "--kpi": surplus ? "#59d499" : "#ff6363" } as React.CSSProperties} className={`key-card key-card-sm kpi ${surplus ? "key-card-surplus" : "key-card-deficit"}`}>
          <div className="flex items-center justify-between text-xs text-zinc-300">
            Dinero realmente libre {surplus ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          </div>
          <p className={`kpi-value mt-3 ${surplus ? "text-emerald-400" : "text-red-400"}`}>{money(s.freeMoney)}</p>
          <p className="mt-1 text-xs text-zinc-400">{surplus ? "Sobrante proyectado" : "Déficit proyectado"}</p>
        </section>
      </div>

      <Panel title="Ingresos vs. gastos y compromisos">
        <div className="space-y-3">
          {bars.map((b) => (
            <div key={b.label}>
              <div className="mb-1 flex justify-between text-xs text-zinc-400"><span>{b.label}</span><span className="tabular-nums">{money(b.v)}</span></div>
              <Bar pct={(b.v / max) * 100} color={b.color} />
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Compromisos = tarjetas {money(s.cardsDue)} + préstamos {money(s.loansDue)} + fijos {money(s.fixedDue)} + ahorro {money(s.savingsBudget)} + gustos {money(s.wantsBudget)}.
        </p>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Tarjetas de crédito" icon={<CreditCard size={15} />}>
          {s.cards.length === 0 && <Empty>Sin tarjetas registradas.</Empty>}
          <div className="space-y-4">
            {s.cards.map((c) => {
              const pct = (Number(c.used) / Number(c.creditLimit)) * 100;
              return (
                <div key={c.id}>
                  <div className="flex justify-between gap-3 text-sm"><span className="min-w-0 break-words">{c.bankName} · {c.cardName}</span><span className="tabular-nums text-amber-400">{money(c.dueThisMonth)}</span></div>
                  <Bar pct={pct} color={pct > 80 ? "bg-rose-500" : "bg-sky-500"} />
                  <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-xs text-zinc-400">
                    <span>Usado {money(c.used)} · Disponible {money(c.available)}</span>
                    <span>Corte {shortDate(c.nextCutoffDate)} ({c.daysToCutoff}d) · Pago {shortDate(c.paymentDueDate)}</span>
                  </div>
                  <p className="text-xs text-zinc-500">Próximo mes (post-corte): {money(c.nextMonthCharges)}</p>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Préstamos" icon={<HandCoins size={15} />}>
          {s.loans.length === 0 && <Empty>Sin préstamos registrados.</Empty>}
          <div className="space-y-4">
            {s.loans.map((l) => {
              const pay = Number(l.currentInterest) + Number(l.currentCapital) || 1;
              return (
                <div key={l.id}>
                  <div className="flex justify-between gap-3 text-sm"><span className="min-w-0 break-words">{l.lenderName}</span><span className="tabular-nums">Saldo {money(l.remainingBalance)}</span></div>
                  <Bar pct={(l.paidInstallments / l.totalInstallments) * 100} />
                  <p className="mt-1 text-xs text-zinc-400">
                    Cuota {l.paidInstallments}/{l.totalInstallments} pagadas · día {l.paymentDay} · intereses restantes {money(l.totalRemainingInterest)}
                  </p>
                  <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div className="bg-rose-500" style={{ width: `${(Number(l.currentInterest) / pay) * 100}%` }} />
                    <div className="bg-emerald-500" style={{ width: `${(Number(l.currentCapital) / pay) * 100}%` }} />
                  </div>
                  <p className="text-xs text-zinc-500">Esta cuota: interés {money(l.currentInterest)} · capital {money(l.currentCapital)}</p>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
