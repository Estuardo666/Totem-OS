"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncClientMetrics } from "@/actions/metrics-actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { RefreshCw, Loader2 } from "lucide-react";

interface SyncMetricsButtonProps {
  clientId: string;
}

/**
 * Botón para sincronizar métricas de Facebook desde la API de Meta
 */
export function SyncMetricsButton({ clientId }: SyncMetricsButtonProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSync = () => {
    startTransition(async () => {
      try {
        const result = await syncClientMetrics(clientId, 28);
        if (result.success && result.data) {
          toast({
            title: "Métricas sincronizadas",
            description: `Se guardaron ${result.data.count} registros de métricas correctamente.`,
          });
          router.refresh();
        } else {
          toast({
            variant: "destructive",
            title: "Error al sincronizar",
            description: result.error || "No se pudieron sincronizar las métricas",
          });
        }
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

