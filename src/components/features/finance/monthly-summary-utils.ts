export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function getAlertClasses(tone: "healthy" | "warning" | "critical") {
  if (tone === "healthy") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-rose-200 bg-rose-50 text-rose-900";
}

export function getStatusClasses(status: "Al día" | "Pendiente" | "Pago parcial" | "Sin movimiento") {
  switch (status) {
    case "Al día":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Pago parcial":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Pendiente":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}
