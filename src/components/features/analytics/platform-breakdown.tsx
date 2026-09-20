import { Badge } from "@/components/ui/badge";
import { formatNumber, formatRatio } from "@/components/features/reports/social-report/report-tokens";
import type { PlatformAnalytics } from "@/lib/metrics/analytics-data";

interface PlatformBreakdownProps {
  platforms: PlatformAnalytics[];
}

interface RowProps {
  label: string;
  value: string;
  hint?: string;
}

function Row({ label, value, hint }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">
        {label}
        {hint ? <span className="ml-1 text-muted-foreground/60">({hint})</span> : null}
      </span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Detalle por red. Cada plataforma muestra solo lo que su API entrega: dejar
 * un "0" donde Meta no da el dato haría pasar un hueco por un mal resultado.
 */
export function PlatformBreakdown({ platforms }: PlatformBreakdownProps) {
  const visible = platforms.filter((p) => p.connected);

  if (visible.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        No hay redes sociales vinculadas a este cliente.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visible.map((platform) => (
        <div key={platform.platform} className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{platform.label}</h3>
            <Badge variant={platform.hasData ? "secondary" : "outline"}>
              {platform.hasData ? "Con datos" : "Sin datos"}
            </Badge>
          </div>

          <div className="mt-3">
            <Row label="Visualizaciones" value={formatNumber(platform.reach)} />
            <Row label="Interacciones" value={formatNumber(platform.engagement)} />
            <Row label="Seguidores" value={formatNumber(platform.followers)} />
            {platform.profileViews > 0 ? (
              <Row label="Visitas al perfil" value={formatNumber(platform.profileViews)} />
            ) : null}
            {platform.linkClicks > 0 ? (
              <Row label="Clics a enlaces" value={formatNumber(platform.linkClicks)} />
            ) : null}
            {platform.videoViews > 0 ? (
              <Row label="Reproducciones de video" value={formatNumber(platform.videoViews)} />
            ) : null}
            {platform.followsGained > 0 || platform.followsLost > 0 ? (
              <Row
                label="Seguidores netos"
                value={formatNumber(platform.derived.netFollowers)}
                hint={`+${formatNumber(platform.followsGained)} / -${formatNumber(platform.followsLost)}`}
              />
            ) : null}
            {platform.shares > 0 ? (
              <Row label="Compartidos" value={formatNumber(platform.shares)} />
            ) : null}
            {platform.saves > 0 ? <Row label="Guardados" value={formatNumber(platform.saves)} /> : null}
            <Row
              label="ER sobre alcance"
              value={formatRatio(platform.derived.engagementRateByReach, "%")}
            />
            <Row
              label="ER sobre seguidores"
              value={formatRatio(platform.derived.engagementRateByFollowers, "%")}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
