import { formatNumber } from "@/components/features/reports/social-report/report-tokens";
import type { AudienceBreakdown } from "@/lib/metrics/analytics-data";

interface AudienceDemographicsProps {
  audience: AudienceBreakdown[];
}

/**
 * Demografía de seguidores de Instagram.
 *
 * Se oculta por completo cuando Meta no entrega datos —exige 100 seguidores
 * como mínimo—, en vez de dibujar barras vacías que se leerían como una
 * audiencia inexistente.
 */
export function AudienceDemographics({ audience }: AudienceDemographicsProps) {
  if (audience.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Meta entrega demografía de audiencia solo a partir de 100 seguidores en Instagram.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {audience.map((group) => (
        <div key={group.dimension} className="rounded-xl border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">{group.label}</h3>
            <span className="text-xs text-muted-foreground">
              {formatNumber(group.total)} seguidores
            </span>
          </div>

          <ul className="mt-3 space-y-2">
            {group.entries.map((entry) => (
              <li key={entry.key}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate">{entry.key}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatNumber(entry.value)} · {entry.share.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, entry.share)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
