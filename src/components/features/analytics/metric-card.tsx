import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  /** Valor ya formateado. "—" cuando la métrica no es calculable. */
  value: string;
  /** Definición en español llano: nadie debería tener que adivinar la fórmula. */
  hint: string;
  /** Contexto secundario (base del cálculo, período anterior…). */
  footnote?: string;
  className?: string;
}

/**
 * Tarjeta de una métrica calculada.
 *
 * Siempre lleva su definición debajo. Una métrica derivada sin fórmula visible
 * es un número que el cliente no puede auditar, y entonces no sirve para
 * sostener una decisión.
 */
export function MetricCard({ label, value, hint, footnote, className }: MetricCardProps) {
  const isEmpty = value === "—";

  return (
    <div className={cn("rounded-xl border bg-card p-4", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums leading-none",
          isEmpty && "text-muted-foreground"
        )}
      >
        {value}
      </p>
      {footnote ? <p className="mt-1 text-xs text-muted-foreground">{footnote}</p> : null}
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground/80">{hint}</p>
    </div>
  );
}
