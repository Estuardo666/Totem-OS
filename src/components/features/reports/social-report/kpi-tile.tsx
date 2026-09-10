import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeltaPct } from "@/lib/reports/social-report-math";
import { formatDeltaPct } from "./report-tokens";

interface KpiTileProps {
  label: string;
  value: string;
  delta: DeltaPct;
  /** Cómo mostrar el valor anterior, ya formateado. */
  previousFormatted: string;
  previousLabel: string;
  /** Definición en español llano, para quien no conozca el término. */
  hint: string;
  /** Para inversión, subir no es "bueno": se muestra neutro. */
  neutralDirection?: boolean;
}

const DIRECTION_ICON = {
  up: ArrowUp,
  down: ArrowDown,
  flat: ArrowRight,
} as const;

/**
 * Tarjeta de KPI.
 *
 * Nunca muestra un porcentaje sin su base: debajo del cambio siempre va el
 * valor del mes anterior. Un "+40%" sin saber sobre qué no dice nada.
 */
export function KpiTile({
  label,
  value,
  delta,
  previousFormatted,
  previousLabel,
  hint,
  neutralDirection = false,
}: KpiTileProps) {
  const Icon = DIRECTION_ICON[delta.direction];
  const isNew = delta.pct === null;

  const tone = neutralDirection || delta.direction === "flat" || isNew
    ? "text-muted-foreground"
    : delta.direction === "up"
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-red-700 dark:text-red-400";

  return (
    <div className="rounded-xl border bg-card p-4 print:break-inside-avoid">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <p className="mt-2 text-3xl font-semibold tabular-nums leading-none">{value}</p>

      <div className={cn("mt-2 flex items-center gap-1 text-sm font-medium", tone)}>
        {/* El icono acompaña al texto; la dirección nunca se codifica solo en color. */}
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{formatDeltaPct(delta.pct)}</span>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {isNew
          ? `Sin datos en ${previousLabel}`
          : `${previousLabel}: ${previousFormatted}`}
      </p>

      <p className="mt-2 text-[11px] leading-snug text-muted-foreground/80">{hint}</p>
    </div>
  );
}
