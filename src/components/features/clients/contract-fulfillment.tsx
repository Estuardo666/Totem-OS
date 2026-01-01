"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getContractFulfillment } from "@/actions/client-actions";

interface ContractFulfillmentProps {
  clientId: string;
  monthlyReels: number;
  monthlyFlyers: number;
}

export function ContractFulfillment({
  clientId,
  monthlyReels,
  monthlyFlyers,
}: ContractFulfillmentProps) {
  const pathname = usePathname();
  const [publishedReels, setPublishedReels] = useState<number>(0);
  const [publishedFlyers, setPublishedFlyers] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const loadCounts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getContractFulfillment(clientId);
      if (result.success && result.data) {
        setPublishedReels(result.data.publishedReels);
        setPublishedFlyers(result.data.publishedFlyers);
      }
    } catch (error) {
      console.error("Error al cargar conteos:", error);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts, pathname]);

  // Escuchar eventos personalizados cuando se actualiza una tarea
  useEffect(() => {
    const handleTaskUpdate = () => {
      // Esperar un poco para que la base de datos se actualice
      setTimeout(() => {
        loadCounts();
      }, 500);
    };

    // Escuchar evento personalizado
    window.addEventListener("taskStatusUpdated", handleTaskUpdate);
    window.addEventListener("taskUpdated", handleTaskUpdate);

    return () => {
      window.removeEventListener("taskStatusUpdated", handleTaskUpdate);
      window.removeEventListener("taskUpdated", handleTaskUpdate);
    };
  }, [loadCounts]);

  // Si no hay plan contratado, no mostrar nada
  if (monthlyReels === 0 && monthlyFlyers === 0) {
    return null;
  }

  const reelsFulfilled = monthlyReels > 0 && publishedReels >= monthlyReels;
  const flyersFulfilled = monthlyFlyers > 0 && publishedFlyers >= monthlyFlyers;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">Cumplimiento del Plan Mensual</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadCounts}
          disabled={loading}
          className="h-8 w-8 p-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <>
            {monthlyReels > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {reelsFulfilled ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">Reels</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={reelsFulfilled ? "default" : "secondary"}
                      className={
                        reelsFulfilled
                          ? "bg-green-500 hover:bg-green-600 text-white"
                          : ""
                      }
                    >
                      {publishedReels}/{monthlyReels}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progreso Mensual</span>
                    <span>{Math.round((publishedReels / monthlyReels) * 100)}%</span>
                  </div>
                  <Progress
                    value={(publishedReels / monthlyReels) * 100}
                    className="h-2"
                  />
                </div>
              </div>
            )}

            {monthlyFlyers > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {flyersFulfilled ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">Flyers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={flyersFulfilled ? "default" : "secondary"}
                      className={
                        flyersFulfilled
                          ? "bg-green-500 hover:bg-green-600 text-white"
                          : ""
                      }
                    >
                      {publishedFlyers}/{monthlyFlyers}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progreso Mensual</span>
                    <span>
                      {monthlyFlyers > 0
                        ? Math.round((publishedFlyers / monthlyFlyers) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <Progress
                    value={
                      monthlyFlyers > 0
                        ? (publishedFlyers / monthlyFlyers) * 100
                        : 0
                    }
                    className="h-2"
                  />
                </div>
              </div>
            )}

            {(reelsFulfilled || flyersFulfilled) && (
              <div className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
                {reelsFulfilled && flyersFulfilled
                  ? "¡Plan mensual completado! Se generará el cobro automático."
                  : reelsFulfilled
                    ? "Reels completados. Esperando Flyers para completar el plan."
                    : "Flyers completados. Esperando Reels para completar el plan."}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

