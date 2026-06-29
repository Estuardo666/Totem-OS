"use client";

export interface SortConfig {
  key: string | null;
  direction: "asc" | "desc" | null;
}

export function nextSortDirection(current: "asc" | "desc" | null): "asc" | "desc" | null {
  if (current === null) return "asc";
  if (current === "asc") return "desc";
  return null;
}

export function compareStrings(a: string, b: string, dir: "asc" | "desc"): number {
  const cmp = a.localeCompare(b, "es", { sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}

export function compareNumbers(a: number, b: number, dir: "asc" | "desc"): number {
  return dir === "asc" ? a - b : b - a;
}

export function compareDates(a: Date, b: Date, dir: "asc" | "desc"): number {
  return dir === "asc" ? a.getTime() - b.getTime() : b.getTime() - a.getTime();
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyCompact(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const CATEGORY_LABELS: Record<string, string> = {
  COMIDA: "Comida",
  TRANSPORTE: "Transporte",
  INVITACIONES: "Invitaciones",
  SOFTWARE: "Software",
  OFICINA: "Oficina",
  EQUIPOS: "Equipos",
  OTROS: "Otros",
};

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function getStatusOrder(status: string, reimbursed: boolean): number {
  if (reimbursed || status === "PAID" || status === "REIMBURSED") return 0;
  if (status === "EMPRESA") return 2;
  return 1;
}

export function getStatusLabel(status: string, reimbursed: boolean): string {
  if (reimbursed || status === "PAID" || status === "REIMBURSED") return "Reembolsado";
  return "Pendiente";
}
