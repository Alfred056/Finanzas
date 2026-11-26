"use client";
import { useState } from "react";
import { ChartPie } from "lucide-react";
import { money, useApi, type Category, type Summary } from "@/lib/api";
import { Bar, Empty, Panel } from "./ui";
import { CategoryBadge, categoryColor } from "./CategoryColor";

const ALL = "";

/** Gasto del mes por categoría: vista general o detalle de una categoría elegida. */
export function CategorySpending({ summary, version }: { summary: Summary; version: number }) {
  const { data, error } = useApi<Category[]>("/api/categories", version);
  const categories = data ?? [];
  const [selected, setSelected] = useState(ALL);

  const rows = summary.expensesByCategory;
  // Categorías del usuario más las que tienen gastos sin estar registradas (ej. "Sin categoría").
  const names = [...new Set([...categories.map((c) => c.name), ...rows.map((r) => r.category)])].sort((a, b) => a.localeCompare(b, "es"));
  const detail = rows.find((r) => r.category === selected) ?? { category: selected, total: "0", percentage: "0.0" };

  return (
    <Panel title="Gasto total del mes por categoría" icon={<ChartPie size={15} />}>
      <div className="space-y-3">
        <select aria-label="Categoría a consultar" value={selected} onChange={(e) => setSelected(e.target.value)} className="input-well sm:!w-64">
          <option value={ALL}>Todas las categorías</option>
          {names.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        {error && <p className="text-xs text-red-400">No se pudieron cargar las categorías: {error}</p>}

        {selected === ALL ? (
          <>
            <p className="text-3xl font-semibold tabular-nums text-white">{money(summary.expenses)}</p>
            {rows.length === 0 && <Empty>Sin gastos en este mes.</Empty>}
            {rows.map((r) => {
              const color = categoryColor(categories, r.category);
              return (
                <div key={r.category}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <CategoryBadge name={r.category} color={color} />
                    <span className="shrink-0 tabular-nums">{money(r.total)} <span className="text-xs text-zinc-400">· {r.percentage}%</span></span>
                  </div>
                  <Bar pct={Number(r.percentage)} fill={color} />
                </div>
              );
            })}
          </>
        ) : (
          <div className="space-y-3" aria-live="polite">
            <CategoryBadge name={selected} color={categoryColor(categories, selected)} />
            <p className="break-words text-3xl font-semibold tabular-nums text-white">{money(detail.total)}</p>
            <Bar pct={Number(detail.percentage)} fill={categoryColor(categories, selected)} />
            <p className="text-xs text-zinc-400">{detail.percentage}% del gasto total del mes ({money(summary.expenses)})</p>
          </div>
        )}
      </div>
    </Panel>
  );
}
