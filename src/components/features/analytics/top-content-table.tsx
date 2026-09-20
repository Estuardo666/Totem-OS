"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber, formatRatio } from "@/components/features/reports/social-report/report-tokens";
import type { MediaRow } from "@/lib/metrics/analytics-data";

type SortKey = "reach" | "interactions" | "engagementRate" | "publishedAt";

const SORT_LABELS: Array<{ key: SortKey; label: string }> = [
  { key: "publishedAt", label: "Más recientes" },
  { key: "reach", label: "Más alcance" },
  { key: "interactions", label: "Más interacciones" },
  { key: "engagementRate", label: "Mejor ER" },
];

interface TopContentTableProps {
  media: MediaRow[];
}

/**
 * Rendimiento por publicación.
 *
 * El ER de cada pieza se calcula sobre su alcance; en Facebook, que ya no
 * expone alcance por publicación, el denominador son las visualizaciones. La
 * columna lo declara para que nadie compare esos dos números como si fueran lo
 * mismo.
 */
export function TopContentTable({ media }: TopContentTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("reach");

  const sorted = useMemo(() => {
    const copy = [...media];
    copy.sort((a, b) => {
      if (sortKey === "publishedAt") return b.publishedAt.getTime() - a.publishedAt.getTime();
      if (sortKey === "engagementRate") return (b.engagementRate ?? -1) - (a.engagementRate ?? -1);
      if (sortKey === "interactions") return b.interactions - a.interactions;
      return b.reach - a.reach;
    });
    return copy.slice(0, 15);
  }, [media, sortKey]);

  if (media.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Sin publicaciones sincronizadas en este período.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <span className="text-xs text-muted-foreground">Ordenar por</span>
        {SORT_LABELS.map((option) => (
          <Button
            key={option.key}
            type="button"
            size="sm"
            variant={option.key === sortKey ? "secondary" : "ghost"}
            className="h-7 px-2 text-xs"
            aria-pressed={option.key === sortKey}
            onClick={() => setSortKey(option.key)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-3 font-medium">Publicación</th>
              <th className="p-3 font-medium text-right">Alcance</th>
              <th className="p-3 font-medium text-right">Vistas</th>
              <th className="p-3 font-medium text-right">Interacciones</th>
              <th className="p-3 font-medium text-right">Guardados</th>
              <th className="p-3 font-medium text-right">Compartidos</th>
              <th className="p-3 font-medium text-right">ER</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={`${item.platform}-${item.mediaId}`} className="border-b last:border-0">
                <td className="p-3">
                  <div className="flex items-start gap-3">
                    {item.thumbnailUrl ? (
                      // Miniaturas servidas por CDN de Meta: sin optimizar para
                      // no exigir allowlist de dominios en next.config.
                      <Image
                        src={item.thumbnailUrl}
                        alt=""
                        width={44}
                        height={44}
                        unoptimized
                        className="h-11 w-11 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="h-11 w-11 shrink-0 rounded bg-muted" />
                    )}
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-xs leading-snug">
                        {item.caption?.trim() || "Sin texto"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {item.platform === "INSTAGRAM" ? "Instagram" : "Facebook"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {format(item.publishedAt, "d MMM", { locale: es })}
                        </span>
                        {item.permalink ? (
                          <a
                            href={item.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                          >
                            Ver <ExternalLink className="h-2.5 w-2.5" aria-hidden />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-right tabular-nums">
                  {item.reach > 0 ? formatNumber(item.reach) : "—"}
                </td>
                <td className="p-3 text-right tabular-nums">{formatNumber(item.views)}</td>
                <td className="p-3 text-right tabular-nums">{formatNumber(item.interactions)}</td>
                <td className="p-3 text-right tabular-nums">{formatNumber(item.saves)}</td>
                <td className="p-3 text-right tabular-nums">{formatNumber(item.shares)}</td>
                <td className="p-3 text-right tabular-nums">
                  {formatRatio(item.engagementRate, "%")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t p-3 text-[11px] text-muted-foreground">
        En Facebook, Meta retiró el alcance por publicación: ahí el ER se calcula sobre
        visualizaciones.
      </p>
    </div>
  );
}
