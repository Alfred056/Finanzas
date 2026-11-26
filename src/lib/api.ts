"use client";
import { useEffect, useState } from "react";

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
  return data as T;
}

export const post = <T,>(url: string, body: unknown) =>
  api<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** GET con recarga al cambiar url o `version` (se incrementa tras cada escritura). */
export function useApi<T>(url: string, version: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let off = false;
    api<T>(url)
      .then((d) => { if (!off) { setData(d); setError(""); } })
      .catch((e: Error) => { if (!off) setError(e.message); });
    return () => { off = true; };
  }, [url, version]);
  return { data, error };
}

export const money = (v: string | number, currency = "PEN") =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(Number(v));

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", timeZone: "UTC" });

/* Tipos de las respuestas (espejo de la API) */
export interface Account { id: string; bankName: string; accountName: string; currency: "PEN" | "USD"; balance: string }
export interface Card { id: string; bankName: string; cardName: string; creditLimit: string; cutoffDay: number; paymentDueDay: number }
export interface Loan {
  id: string; lenderName: string; principalAmount: string; annualInterestRate: string;
  totalInstallments: number; paidInstallments: number; monthlyPayment: string; paymentDay: number;
}
export interface Category { id: string; name: string; type: "EXPENSE" | "INCOME" | "BOTH"; color: string | null }
export interface FixedExpense {
  id: string; name: string; amount: string; dueDay: number; category: string; active: boolean;
  bankAccountId: string | null; creditCardId: string | null; paidThisMonth: boolean;
}
export interface Plan { id: string; name: string; type: "SAVINGS" | "WANTS"; monthlyTarget: string }
export interface Tx {
  id: string; type: "INCOME" | "EXPENSE" | "CARD_PAYMENT" | "LOAN_PAYMENT"; amount: string; date: string;
  category: string; description: string; isHistorical: boolean;
  bankAccountId: string | null; creditCardId: string | null;
  /** Color de su categoría (lo añade el GET de movimientos). */
  color: string;
}
export interface Summary {
  month: number; year: number;
  bankBalances: Record<string, string>; bankTotal: string; cardsDue: string; loansDue: string; fixedDue: string;
  savingsBudget: string; wantsBudget: string; income: string; expenses: string; commitments: string;
  freeMoney: string; projection: { amount: string; status: "SURPLUS" | "DEFICIT" };
  expensesByCategory: { category: string; total: string; percentage: string }[];
  cards: {
    id: string; bankName: string; cardName: string; creditLimit: string; used: string; available: string;
    statementCutoff: string; paymentDueDate: string; billedThisMonth: string; dueThisMonth: string;
    nextMonthCharges: string; nextCutoffDate: string; daysToCutoff: number;
  }[];
  loans: {
    id: string; lenderName: string; paymentDay: number; totalInstallments: number; paidInstallments: number;
    remainingBalance: string; remainingInstallments: number; currentInterest: string; currentCapital: string;
    nextPayment: string; totalRemainingInterest: string;
  }[];
}
