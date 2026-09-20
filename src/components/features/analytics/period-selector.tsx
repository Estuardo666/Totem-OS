"use client";

import { Button } from "@/components/ui/button";
import { ANALYTICS_PERIODS, type AnalyticsPeriod } from "@/lib/metrics/analytics-data";

interface PeriodSelectorProps {
  value: AnalyticsPeriod;
  onChange: (value: AnalyticsPeriod) => void;
  disabled?: boolean;
}

/**
 * Selector de ventana. Tres opciones fijas porque son las tres que la API de
 * Meta soporta con garantías: más de 90 días devuelve error.
 */
export function PeriodSelector({ value, onChange, disabled }: PeriodSelectorProps) {
  return (
    <div className="inline-flex rounded-lg border bg-card p-1" role="group" aria-label="Período">
      {ANALYTICS_PERIODS.map((period) => (
        <Button
          key={period}
          type="button"
          size="sm"
          variant={period === value ? "default" : "ghost"}
          className="h-8 px-3 text-xs"
          aria-pressed={period === value}
          disabled={disabled}
          onClick={() => onChange(period)}
        >
          {period} días
        </Button>
      ))}
    </div>
  );
}
