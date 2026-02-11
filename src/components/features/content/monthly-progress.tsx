"use client";

import { useEffect, useState, useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getContractFulfillment } from "@/actions/client-actions";
import type { Client } from "@prisma/client";

interface MonthlyProgressProps {
  selectedClientId: string | null;
  clients: Client[];
}

export function MonthlyProgress({
  selectedClientId,
  clients,
}: MonthlyProgressProps) {
  const [publishedReels, setPublishedReels] = useState<number>(0);
  const [publishedFlyers, setPublishedFlyers] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const selectedClient = useMemo(() => {
    if (!selectedClientId || selectedClientId === "all") return null;
    return clients.find((c) => c.id === selectedClientId) || null;
  }, [selectedClientId, clients]);

  useEffect(() => {
    async function loadProgress() {
      if (!selectedClient) {
        setPublishedReels(0);
        setPublishedFlyers(0);
        return;
      }

      setLoading(true);
      try {
        const result = await getContractFulfillment(selectedClient.id);
        if (result.success && result.data) {
          setPublishedReels(result.data.publishedReels);
          setPublishedFlyers(result.data.publishedFlyers);
        }
      } catch (error) {
        console.error("Error al cargar progreso:", error);
      } finally {
        setLoading(false);
      }
    }

    loadProgress();

    // Escuchar eventos de actualización de tareas
    const handleTaskUpdate = () => {
      setTimeout(() => {
        loadProgress();
      }, 500);
    };

    window.addEventListener("taskStatusUpdated", handleTaskUpdate);
    window.addEventListener("taskUpdated", handleTaskUpdate);

    return () => {
      window.removeEventListener("taskStatusUpdated", handleTaskUpdate);
      window.removeEventListener("taskUpdated", handleTaskUpdate);
    };
  }, [selectedClient]);

  // Si no hay cliente seleccionado o no tiene plan, no mostrar nada
  if (!selectedClient || (selectedClient.monthlyReels === 0 && selectedClient.monthlyFlyers === 0)) {
    return null;
  }

  const reelsProgress =
    selectedClient.monthlyReels > 0
      ? (publishedReels / selectedClient.monthlyReels) * 100
      : 0;
  const flyersProgress =
    selectedClient.monthlyFlyers > 0
      ? (publishedFlyers / selectedClient.monthlyFlyers) * 100
      : 0;

  return (
    <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Progreso del Mes - {selectedClient.name}</h3>
          {loading && (
            <Badge variant="secondary" className="text-xs">
              Cargando...
            </Badge>
          )}
        </div>

        <div className="space-y-3">
          {selectedClient.monthlyReels > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Reels</span>
                <span className="font-medium">{publishedReels}/{selectedClient.monthlyReels}</span>
              </div>
              <Progress value={reelsProgress} className="h-2" />
            </div>
          )}

          {selectedClient.monthlyFlyers > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Flyers</span>
                <span className="font-medium">{publishedFlyers}/{selectedClient.monthlyFlyers}</span>
              </div>
              <Progress value={flyersProgress} className="h-2" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

