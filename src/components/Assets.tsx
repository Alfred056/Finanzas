"use client";
import { useState } from "react";
import { Check, CreditCard, HandCoins, Landmark, Repeat, Tags, Trash2 } from "lucide-react";
import { api, money, useApi, type Account, type Card, type Category, type FixedExpense, type Loan } from "@/lib/api";
import { Empty, Panel, QuickForm } from "./ui";
import { CategoryBadge, categoryColor } from "./CategoryColor";
import type { ViewProps } from "./AppShell";

const row = "flex items-center justify-between gap-3 border-b border-zinc-800 py-2 text-sm last:border-0 [&>span:first-child]:min-w-0 [&>span:first-child]:break-words";

function FixedExpenses({ month, year, version, refresh }: ViewProps) {
  const items = useApi<FixedExpense[]>(`/api/fixed-expenses?month=${month}&year=${year}`, version).data;
  const accounts = useApi<Account[]>("/api/accounts", version).data ?? [];
  const cards = useApi<Card[]>("/api/cards", version).data ?? [];
  const cats = useApi<Category[]>("/api/categories", version).data ?? [];
  const [error, setError] = useState("");

  async function act(url: string, method: "POST" | "DELETE") {
    setError("");
    try { await api(url, { method }); refresh(); } catch (e) { setError((e as Error).message); }
  }

  return (
    <Panel title="Gastos fijos" icon={<Repeat size={15} />} className="lg:col-span-3">
      {items?.length === 0 && <Empty>Sin gastos fijos.</Empty>}
      {items?.map((f) => (
        <div key={f.id} className={row}>
          <span>{f.name}<br /><span className="text-xs text-zinc-500">{f.category} · día {f.dueDay}</span></span>
          <span className="flex items-center gap-2">
            <span className="tabular-nums">{money(f.amount)}</span>
            {f.paidThisMonth ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><Check size={13} /> Pagado</span>
            ) : (
              <button onClick={() => act(`/api/fixed-expenses/${f.id}/pay`, "POST")} className="btn-primary !px-2 !py-1 !text-xs">Pagar</button>
            )}
            <button aria-label="Eliminar" onClick={() => act(`/api/fixed-expenses?id=${f.id}`, "DELETE")} className="text-zinc-500 hover:text-red-400"><Trash2 size={14} /></button>
          </span>
        </div>
      ))}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <div className="mt-4 border-t border-zinc-800 pt-4">
        <QuickForm
          title="Nuevo gasto fijo" endpoint="/api/fixed-expenses" onDone={refresh}
          fields={[
            { name: "name", label: "Nombre" },
            { name: "amount", label: "Monto", type: "number" },
            { name: "dueDay", label: "Día de vencimiento", type: "number", step: "1" },
            { name: "category", label: "Categoría", type: "select", required: false, options: [["", "Servicios"], ...cats.map((c): [string, string] => [c.name, c.name])] },
            { name: "bankAccountId", label: "Cuenta", type: "select", required: false, options: [["", "—"], ...accounts.map((a): [string, string] => [a.id, `${a.bankName} ${a.accountName}`])] },
            { name: "creditCardId", label: "Tarjeta", type: "select", required: false, options: [["", "—"], ...cards.map((c): [string, string] => [c.id, `${c.bankName} ${c.cardName}`])] },
          ]}
        />
      </div>
    </Panel>
  );
}

function Categories({ version, refresh }: ViewProps) {
  const { data: cats, error } = useApi<Category[]>("/api/categories", version);
  const label = { EXPENSE: "Gasto", INCOME: "Ingreso", BOTH: "Ambos" };
  return (
    <Panel title="Categorías" icon={<Tags size={15} />} className="lg:col-span-3">
      <div className="mb-4 flex flex-wrap gap-2">
        {error && <p className="text-xs text-red-400">No se pudieron cargar las categorías: {error}</p>}
        {cats?.length === 0 && <Empty>Sin categorías.</Empty>}
        {cats?.map((c) => (
          <CategoryBadge key={c.id} name={c.name} color={categoryColor(cats ?? [], c.name)}>
            <span className="shrink-0 text-zinc-400">· {label[c.type]}</span>
          </CategoryBadge>
        ))}
      </div>
      <QuickForm
        title="Nueva categoría" endpoint="/api/categories" onDone={refresh}
        fields={[
          { name: "name", label: "Nombre" },
          { name: "type", label: "Tipo", type: "select", initial: "BOTH", options: [["BOTH", "Ambos"], ["EXPENSE", "Gasto"], ["INCOME", "Ingreso"]] },
          { name: "color", label: "Color", type: "color" },
        ]}
      />
    </Panel>
  );
}

export function Assets(props: ViewProps) {
  const { version, refresh } = props;
  const accounts = useApi<Account[]>("/api/accounts", version).data;
  const cards = useApi<Card[]>("/api/cards", version).data;
  const loans = useApi<Loan[]>("/api/loans", version).data;

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
      <Categories {...props} />

      <Panel title="Cuentas bancarias" icon={<Landmark size={15} />}>
        {accounts?.length === 0 && <Empty>Sin cuentas.</Empty>}
        {accounts?.map((a) => (
          <div key={a.id} className={row}><span>{a.bankName} · {a.accountName}</span><span className="tabular-nums">{money(a.balance, a.currency)}</span></div>
        ))}
        <div className="mt-4 border-t border-zinc-800 pt-4">
          <QuickForm
            title="Nueva cuenta" endpoint="/api/accounts" onDone={refresh}
            fields={[
              { name: "bankName", label: "Banco" },
              { name: "accountName", label: "Nombre" },
              { name: "currency", label: "Moneda", type: "select", initial: "PEN", options: [["PEN", "PEN"], ["USD", "USD"]] },
              { name: "balance", label: "Saldo", type: "number" },
            ]}
          />
        </div>
      </Panel>

      <Panel title="Tarjetas de crédito" icon={<CreditCard size={15} />}>
        {cards?.length === 0 && <Empty>Sin tarjetas.</Empty>}
        {cards?.map((c) => (
          <div key={c.id} className={row}>
            <span>{c.bankName} · {c.cardName}<br /><span className="text-xs text-zinc-500">Corte {c.cutoffDay} · Pago {c.paymentDueDay}</span></span>
            <span className="tabular-nums">{money(c.creditLimit)}</span>
          </div>
        ))}
        <div className="mt-4 border-t border-zinc-800 pt-4">
          <QuickForm
            title="Nueva tarjeta" endpoint="/api/cards" onDone={refresh}
            fields={[
              { name: "bankName", label: "Banco" },
              { name: "cardName", label: "Tarjeta" },
              { name: "creditLimit", label: "Línea", type: "number" },
              { name: "cutoffDay", label: "Día de corte", type: "number", step: "1" },
              { name: "paymentDueDay", label: "Día de pago", type: "number", step: "1" },
            ]}
          />
        </div>
      </Panel>

      <Panel title="Préstamos" icon={<HandCoins size={15} />}>
        {loans?.length === 0 && <Empty>Sin préstamos.</Empty>}
        {loans?.map((l) => (
          <div key={l.id} className={row}>
            <span>{l.lenderName}<br /><span className="text-xs text-zinc-500">{l.paidInstallments}/{l.totalInstallments} cuotas · {l.annualInterestRate}%</span></span>
            <span className="tabular-nums">{money(l.monthlyPayment)}</span>
          </div>
        ))}
        <div className="mt-4 border-t border-zinc-800 pt-4">
          <QuickForm
            title="Nuevo préstamo" endpoint="/api/loans" onDone={refresh}
            fields={[
              { name: "lenderName", label: "Entidad" },
              { name: "principalAmount", label: "Monto", type: "number" },
              { name: "annualInterestRate", label: "Tasa anual %", type: "number" },
              { name: "totalInstallments", label: "Nº cuotas", type: "number", step: "1" },
              { name: "paidInstallments", label: "Cuotas pagadas", type: "number", step: "1", required: false },
              { name: "monthlyPayment", label: "Cuota mensual", type: "number" },
              { name: "paymentDay", label: "Día de pago", type: "number", step: "1" },
            ]}
          />
        </div>
      </Panel>

      <FixedExpenses {...props} />
    </div>
  );
}
