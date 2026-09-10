"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncClientPlatforms } from "@/actions/metrics-actions";
import type { PlatformSyncResult } from "@/lib/meta/sync-types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { RefreshCw, Loader2 } from "lucide-react";

interface SyncMetricsButtonProps {
  clientId: string;
}

const PLATFORM_LABEL: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  META_ADS: "Anuncios",
  TIKTOK: "TikTok",
};

/**
 * Resume la corrida en una frase.
 *
 * Distingue tres casos que antes se confundían en un solo error: hubo datos,
 * no había nada que traer porque no hay cuentas vinculadas, o algo falló de
 * verdad. Un cliente con solo anuncios vinculados ya no ve "sin página de
 * Facebook" como si fuera un error.
 */
function summarize(results: PlatformSyncResult[]): {
  variant: "default" | "destructive";
  title: string;
  description: string;
} {
  const ok = results.filter((r) => r.status === "OK");
  const errored = results.filter((r) => r.status === "ERROR");
  const total = ok.reduce((sum, r) => sum + r.count, 0);

  const detail = ok
    .map((r) => `${PLATFORM_LABEL[r.platform] ?? r.platform}: ${r.count}`)
    .join(" · ");

  if (ok.length > 0) {
    const failures = errored.length
      ? ` No se pudo con ${errored.map((r) => PLATFORM_LABEL[r.platform] ?? r.platform).join(", ")}.`
      : "";
    return {
      variant: "default",
      title: `${total} registros sincronizados`,
      description: `${detail}.${failures}`,
    };
  }

  if (errored.length > 0) {
    return {
      variant: "destructive",
      title: "Error al sincronizar",
      description: errored
        .map((r) => `${PLATFORM_LABEL[r.platform] ?? r.platform}: ${r.reason ?? "error desconocido"}`)
        .join(" · "),
    };
  }

  // Todo saltado: no es un fallo, es que no hay nada vinculado.
  return {
    variant: "destructive",
    title: "Nada que sincronizar",
    description:
      results
        .map((r) => `${PLATFORM_LABEL[r.platform] ?? r.platform}: ${r.reason ?? "sin datos"}`)
        .join(" · ") || "Este cliente no tiene cuentas de Meta vinculadas.",
  };
}

/**
 * Sincroniza las métricas del cliente en todas las plataformas conectadas.
 */
export function SyncMetricsButton({ clientId }: SyncMetricsButtonProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSync = () => {
    startTransition(async () => {
      try {
        const result = await syncClientPlatforms(clientId, { days: 28 });

        if (!result.success || !result.data) {
          toast({
            variant: "destructive",
            title: "Error al sincronizar",
            description: result.error || "No se pudieron sincronizar las métricas",
          });
          return;
        }

        toast(summarize(result.data.results));
        router.refresh();
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Error inesperado al sincronizar",
        });
      }
    });
  };

  return (
    <Button
      onClick={handleSync}
      disabled={isPending}
      size="sm"
      variant="outline"
      className="gap-2"
    >
      {isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Sincronizando...</span>
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4" />
          <span>Sincronizar Métricas</span>
        </>
      )}
    </Button>
  );
}
