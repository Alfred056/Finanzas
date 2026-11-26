import { money, type Tx } from "@/lib/api";

export const TYPE_LABEL: Record<Tx["type"], string> = { INCOME: "Ingreso", EXPENSE: "Gasto", CARD_PAYMENT: "Pago tarjeta", LOAN_PAYMENT: "Pago préstamo" };

export const signedAmount = (t: Tx) => `${t.type === "INCOME" ? "+" : "−"}${money(t.amount)}`;
