"use client";

import { useState, useTransition, useEffect } from "react";
import { syncClientMetrics } from "@/actions/metrics-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface MetricsDebuggerProps {
  clientId: string;
}

/**
 * Componente de prueba para sincronizar y visualizar métricas de Facebook
 * Muestra las últimas 5 métricas guardadas en la base de datos
 */
export function MetricsDebugger({ clientId }: MetricsDebuggerProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [lastMetrics, setLastMetrics] = useState<string>("");

  const handleSync = () => {
    startTransition(async () => {
      try {
        const result = await syncClientMetrics(clientId, 28);
        if (result.success && result.data) {
          toast({
            title: "Métricas sincronizadas",
            description: `Se guardaron ${result.data.count} registros de métricas.`,
          });
          // Recargar las últimas métricas
          await loadLastMetrics();
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: result.error || "Error al sincronizar métricas",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Error inesperado",
        });
      }
    });
  };

  const loadLastMetrics = async () => {
    try {
      // Llamar a una server action para obtener las últimas métricas
      const response = await fetch(`/api/metrics/${clientId}/latest?limit=5`);
      if (response.ok) {
        const data = await response.json();
        setLastMetrics(JSON.stringify(data, null, 2));
      } else {
        setLastMetrics("No se pudieron cargar las métricas");
      }
    } catch (error) {
      setLastMetrics(`Error: ${error instanceof Error ? error.message : "Error desconocido"}`);
    }
  };

  // Cargar métricas al montar el componente
  useEffect(() => {
    loadLastMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  return (
    <Card className="border-2 border-dashed border-primary/20">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">🔧 Debug: Motor de Métricas</CardTitle>
        <CardDescription className="text-xs">
          Componente temporal para probar la sincronización de métricas de Facebook
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleSync}
          disabled={isPending}
          size="sm"
          variant="outline"
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sincronizar Métricas Ahora
            </>
          )}
        </Button>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Últimas 5 métricas guardadas:
          </label>
          <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64 border">
            {lastMetrics || "Haz clic en 'Sincronizar Métricas Ahora' para cargar datos..."}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

