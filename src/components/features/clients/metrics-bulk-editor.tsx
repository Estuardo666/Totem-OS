"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Calendar } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { updateTaskMetrics } from "@/actions/content-actions";
import { getClientAnnualMetrics } from "@/actions/metrics-actions";
import { format } from "date-fns";

interface TaskWithMetrics {
  id: string;
  title: string;
  type: string;
  publishedAt: Date | null;
  metrics: {
    metaViews: number;
    metaReach: number;
    metaLikes: number;
    metaComments: number;
    metaShares: number;
    metaSaves: number;
    ttViews: number;
    ttLikes: number;
    ttComments: number;
    ttShares: number;
    ttSaves: number;
  } | null;
}

interface MetricsBulkEditorProps {
  clientId: string;
}

export function MetricsBulkEditor({ clientId }: MetricsBulkEditorProps) {
  const [tasks, setTasks] = useState<TaskWithMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { toast } = useToast();

  // Cargar histórico anual
  useEffect(() => {
    const loadMetrics = async () => {
      setIsLoading(true);
      try {
        const result = await getClientAnnualMetrics(clientId, selectedYear);
        if (result.success && result.data) {
          setTasks(result.data);
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: result.error || "No se pudieron cargar las métricas",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Error al cargar las métricas",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadMetrics();
  }, [clientId, selectedYear, toast]);

  const handleSaveMetrics = async (taskId: string, metrics: TaskWithMetrics["metrics"]) => {
    if (!metrics) return;

    setIsSaving(true);
    try {
      const result = await updateTaskMetrics({
        taskId,
        metaViews: metrics.metaViews || 0,
        metaLikes: metrics.metaLikes || 0,
        metaShares: metrics.metaShares || 0,
        metaComments: metrics.metaComments || 0,
        metaSaves: metrics.metaSaves || 0,
        metaReach: metrics.metaReach || 0,
        ttViews: metrics.ttViews || 0,
        ttLikes: metrics.ttLikes || 0,
        ttShares: metrics.ttShares || 0,
        ttComments: metrics.ttComments || 0,
        ttSaves: metrics.ttSaves || 0,
      });

      if (result.success) {
        toast({
          title: "Métricas actualizadas",
          description: "Las métricas se han guardado correctamente",
        });
        // Recargar datos
        const refreshResult = await getClientAnnualMetrics(clientId, selectedYear);
        if (refreshResult.success && refreshResult.data) {
          setTasks(refreshResult.data);
        }
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudieron guardar las métricas",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al guardar las métricas",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateTaskMetric = (
    taskId: string,
    field: keyof NonNullable<TaskWithMetrics["metrics"]>,
    value: number
  ) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) => {
        if (task.id === taskId) {
          return {
            ...task,
            metrics: task.metrics
              ? { ...task.metrics, [field]: value }
              : {
                  metaViews: 0,
                  metaReach: 0,
                  metaLikes: 0,
                  metaComments: 0,
                  metaShares: 0,
                  metaSaves: 0,
                  ttViews: 0,
                  ttLikes: 0,
                  ttComments: 0,
                  ttShares: 0,
                  ttSaves: 0,
                  [field]: value,
                },
          };
        }
        return task;
      })
    );
  };

  // Generar años disponibles (últimos 3 años)
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 3 }, (_, i) => currentYear - i);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Gestión de Datos - Histórico Anual
            </CardTitle>
            <CardDescription>
              Edita métricas masivamente o revisa el histórico anual
            </CardDescription>
          </div>
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(parseInt(value))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay tareas publicadas en {selectedYear}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarea</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-blue-600">Meta Views</TableHead>
                  <TableHead className="text-blue-600">Meta Reach</TableHead>
                  <TableHead className="text-blue-600">Meta Likes</TableHead>
                  <TableHead className="text-black dark:text-white">TT Views</TableHead>
                  <TableHead className="text-black dark:text-white">TT Likes</TableHead>
                  <TableHead>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {task.title}
                    </TableCell>
                    <TableCell>
                      {task.publishedAt
                        ? format(new Date(task.publishedAt), "dd/MM/yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={task.metrics?.metaViews || 0}
                        onChange={(e) =>
                          updateTaskMetric(task.id, "metaViews", parseInt(e.target.value) || 0)
                        }
                        className="w-20 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={task.metrics?.metaReach || 0}
                        onChange={(e) =>
                          updateTaskMetric(task.id, "metaReach", parseInt(e.target.value) || 0)
                        }
                        className="w-20 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={task.metrics?.metaLikes || 0}
                        onChange={(e) =>
                          updateTaskMetric(task.id, "metaLikes", parseInt(e.target.value) || 0)
                        }
                        className="w-20 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={task.metrics?.ttViews || 0}
                        onChange={(e) =>
                          updateTaskMetric(task.id, "ttViews", parseInt(e.target.value) || 0)
                        }
                        className="w-20 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={task.metrics?.ttLikes || 0}
                        onChange={(e) =>
                          updateTaskMetric(task.id, "ttLikes", parseInt(e.target.value) || 0)
                        }
                        className="w-20 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleSaveMetrics(task.id, task.metrics)}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

