"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Square, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { startTimeEntry, stopTimeEntry, getRunningTimeEntry } from "@/actions/time-tracking";
import type { TimeEntry } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function SmartTimer() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [runningEntry, setRunningEntry] = useState<TimeEntry | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Cargar entrada activa al montar
  useEffect(() => {
    loadRunningEntry();
  }, []);

  // Actualizar cronómetro en tiempo real
  useEffect(() => {
    if (!runningEntry) {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const start = new Date(runningEntry.startTime);
      const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
      setElapsedSeconds(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [runningEntry]);

  const loadRunningEntry = async () => {
    const result = await getRunningTimeEntry();
    if (result.success && result.data) {
      setRunningEntry(result.data);
      // Calcular segundos transcurridos
      const now = new Date();
      const start = new Date(result.data.startTime);
      setElapsedSeconds(Math.floor((now.getTime() - start.getTime()) / 1000));
    } else {
      setRunningEntry(null);
      setElapsedSeconds(0);
    }
  };

  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatDuration = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleStart = () => {
    startTransition(async () => {
      try {
        const result = await startTimeEntry();
        if (result.success && result.data) {
          setRunningEntry(result.data);
          setElapsedSeconds(0);
          toast({
            title: "Sesión iniciada",
            description: "El cronómetro ha comenzado a contar.",
          });
          router.refresh();
        } else {
          toast({
            variant: "destructive",
            title: "Error al iniciar sesión",
            description: result.error || "No se pudo iniciar la sesión de trabajo.",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error inesperado",
          description: error instanceof Error ? error.message : "Ocurrió un error inesperado.",
        });
      }
    });
  };

  const handleStop = () => {
    if (!runningEntry) return;

    startTransition(async () => {
      try {
        const result = await stopTimeEntry(runningEntry.id);
        if (result.success && result.data) {
          const duration = result.data.duration || 0;
          const earnings = result.data.earnings || 0;
          const durationFormatted = formatDuration(Math.floor(duration / 60));

          setRunningEntry(null);
          setElapsedSeconds(0);

          toast({
            title: "Sesión guardada",
            description: `${durationFormatted} trabajados. Ganancia: $${earnings.toFixed(2)}`,
          });
          router.refresh();
        } else {
          toast({
            variant: "destructive",
            title: "Error al detener sesión",
            description: result.error || "No se pudo detener la sesión de trabajo.",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error inesperado",
          description: error instanceof Error ? error.message : "Ocurrió un error inesperado.",
        });
      }
    });
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Totem Chronos
        </CardTitle>
        <CardDescription>
          Control de tiempo y cálculo de salario
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cronómetro */}
        <div className="text-center">
          <div className="text-6xl font-bold font-mono tracking-tighter text-primary mb-2">
            {formatTime(elapsedSeconds)}
          </div>
          {runningEntry && (
            <p className="text-sm text-muted-foreground">
              Iniciado {formatDistanceToNow(new Date(runningEntry.startTime), { addSuffix: true, locale: es })}
            </p>
          )}
        </div>

        {/* Botón de acción */}
        <div className="flex justify-center">
          {runningEntry ? (
            <Button
              onClick={handleStop}
              disabled={isPending}
              size="lg"
              variant="destructive"
              className="gap-2 min-w-[200px]"
            >
              <Square className="h-5 w-5" />
              {isPending ? "Deteniendo..." : "Detener & Calcular"}
            </Button>
          ) : (
            <Button
              onClick={handleStart}
              disabled={isPending}
              size="lg"
              className="gap-2 min-w-[200px]"
            >
              <Play className="h-5 w-5" />
              {isPending ? "Iniciando..." : "Iniciar Trabajo"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
