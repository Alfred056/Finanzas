"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight, Landmark, LayoutDashboard, LogOut, PiggyBank, Wallet } from "lucide-react";
import { Dashboard } from "./Dashboard";
import { Assets } from "./Assets";
import { Plans } from "./Plans";
import { Transactions } from "./Transactions";
import { AuthScreen } from "./AuthScreen";
import { api, post } from "@/lib/api";

export interface SessionUser { id: string; username: string; displayName: string }

const TABS = [
  { id: "tx", label: "Movimientos", icon: ArrowLeftRight },
  { id: "dashboard", label: "Resumen", icon: LayoutDashboard },
  { id: "assets", label: "Cuentas y deudas", icon: Landmark },
  { id: "plans", label: "Ahorro y gustos", icon: PiggyBank },
] as const;

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const noopSubscribe = () => () => {};
const clientToday = () => new Date().toISOString().slice(0, 10);

export function AppShell() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("tx");
  // Sin `new Date()` en el render del servidor: el snapshot de servidor es "" y la fecha real se lee solo en el cliente.
  const today = useSyncExternalStore(noopSubscribe, clientToday, () => "");
  const [picked, setPicked] = useState<{ month: number; year: number } | null>(null);
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  useEffect(() => {
    api<{ user: SessionUser | null }>("/api/auth/me").then((r) => setUser(r.user)).catch(() => setUser(null));
  }, []);
  const logout = async () => {
    await post("/api/auth/logout", {}).catch(() => {});
    setUser(null);
    setPicked(null);
    setTab("tx");
  };
  // Al cambiar de pestaña, descarta cualquier desplazamiento horizontal previo.
  useEffect(() => {
    window.scrollTo({ left: 0 });
    document.body.scrollLeft = 0;
  }, [tab]);
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  const period = picked ?? (today ? { month: Number(today.slice(5, 7)), year: Number(today.slice(0, 4)) } : null);
  if (!period || user === undefined) return <p className="p-6 text-zinc-500">Cargando…</p>;
  if (user === null) return <AuthScreen onAuth={setUser} />;
  const { month, year } = period;
  const setPeriod = setPicked;

  const shift = (d: number) => {
    const t = year * 12 + (month - 1) + d;
    setPeriod({ month: (t % 12) + 1, year: Math.floor(t / 12) });
  };

  const sel = "input-well h-9 shrink-0 !py-1";
  const arrow = "btn-ghost shrink-0 !p-1.5";
  const props = { month, year, version, refresh, today };

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl flex-1 overflow-x-clip px-4 pb-5">
      {/* Cabecera y pestañas comparten un solo bloque sticky: así nunca se enciman. */}
      <div className="app-sticky sticky top-0 z-30 -mx-4 mb-6 px-4 pt-3">
      <header className="glass mb-2 flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4">
        <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-3">
        <h1 className="flex items-center gap-2 text-sm font-medium text-white">
          <Wallet className="text-coral-pulse drop-shadow-[0_0_8px_rgba(255,99,99,0.6)]" size={20} /> Finanzas Personales
        </h1>
        <span className="block min-w-0 truncate text-xs text-zinc-400 sm:text-sm">Hola, {user.displayName}</span>
        </div>
        <button className="btn-ghost shrink-0" onClick={logout}><LogOut size={14} /> Cerrar sesión</button>
        <div className="flex w-full min-w-0 items-center justify-center gap-1.5 sm:w-auto">
          <button aria-label="Mes anterior" className={arrow} onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
          <select aria-label="Mes" className={`${sel} !w-[136px] min-w-[115px]`} value={month} onChange={(e) => setPeriod({ month: Number(e.target.value), year })}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <input
            aria-label="Año" type="number" className={`${sel} year-input !w-[76px] !px-2 text-center tabular-nums`} value={year}
            onChange={(e) => Number(e.target.value) > 1970 && setPeriod({ month, year: Number(e.target.value) })}
          />
          <button aria-label="Mes siguiente" className={arrow} onClick={() => shift(1)}><ChevronRight size={16} /></button>
        </div>
      </header>

      <nav className="grid grid-cols-4 border-b border-zinc-800 sm:flex sm:gap-x-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex min-w-0 flex-col items-center gap-1 rounded-t-lg border-b-2 px-1 py-2 text-center text-[11px] font-medium leading-tight sm:flex-row sm:gap-1.5 sm:px-3 sm:text-[13px] ${
              tab === id ? "border-coral-pulse bg-ember-hush/40 text-white shadow-[0_2px_10px_-2px_rgba(255,99,99,0.5)]" : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            <Icon size={15} className={tab === id ? "text-coral-pulse" : ""} /> {label}
          </button>
        ))}
      </nav>
      </div>

      <main key={tab} className="w-full min-w-0 max-w-full">
        {tab === "dashboard" && <Dashboard {...props} />}
        {tab === "assets" && <Assets {...props} />}
        {tab === "plans" && <Plans {...props} />}
        {tab === "tx" && <Transactions {...props} />}
      </main>
    </div>
  );
}

export interface ViewProps { month: number; year: number; version: number; refresh: () => void; today: string }
