"use client";

import { useState, useEffect, useTransition } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { subHours } from "date-fns";
import { Loader2, Trash2, Copy, Check, X, Download, Sparkles } from "lucide-react";
import { updateContentTaskSchema, createContentTaskSchema, type UpdateContentTaskInput, type CreateContentTaskInput, updateTaskMetricsSchema, type UpdateTaskMetricsInput } from "@/schemas/content";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import { updateTask, deleteTask, createTask, getTaskMetrics, updateTaskMetrics, getEnabledMetricsForClient } from "@/actions/content-actions";
import type { TaskMetrics } from "@prisma/client";
import type { UserWithTaskCount } from "@/actions/user.actions";
import type { ContentTaskStatus, ContentTaskType } from "@/types";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UploadButton } from "@uploadthing/react";
import NextImage from "next/image";
import Link from "next/link";
import { AnimatedModal } from "@/components/ui/animated-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateBrandLoyalty, calculateInvestmentEfficiency, formatCurrency } from "@/lib/metrics-calculations";
import { cn } from "@/lib/utils";
import { AiContentAssistant } from "@/components/features/ai/ai-content-assistant";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const CONTENT_TASK_TYPES: readonly ContentTaskType[] = ["REEL", "FLYER", "STORY"];
const CONTENT_TASK_STATUSES: readonly ContentTaskStatus[] = [
  "IDEA",
  "RECORDED",
  "EDITING",
  "REVIEW_INTERNAL",
  "REVIEW_CLIENT",
  "CLIENT_APPROVED",
  "APPROVED",
  "PUBLISHED",
];
const CONTENT_TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

type CreateTaskFormValues = z.input<typeof createContentTaskSchema>;
type UpdateTaskFormValues = z.input<typeof updateContentTaskSchema>;
type TaskFormValues = CreateTaskFormValues | UpdateTaskFormValues;
type TaskPriority = TaskFormValues["priority"];

const isContentTaskType = (value: unknown): value is ContentTaskType =>
  typeof value === "string" && CONTENT_TASK_TYPES.includes(value as ContentTaskType);

const isContentTaskStatus = (value: unknown): value is ContentTaskStatus =>
  typeof value === "string" && CONTENT_TASK_STATUSES.includes(value as ContentTaskStatus);

const isTaskPriority = (value: unknown): value is TaskPriority =>
  typeof value === "string" && (CONTENT_TASK_PRIORITIES as readonly string[]).includes(value);

const ensureTaskType = (value?: string | null): ContentTaskType =>
  isContentTaskType(value) ? value : "REEL";

const ensureTaskStatus = (value?: string | null): ContentTaskStatus =>
  isContentTaskStatus(value) ? value : "IDEA";

const ensureTaskPriority = (value?: string | null): TaskPriority =>
  isTaskPriority(value) ? (value as TaskPriority) : "MEDIUM";

const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const formatDateForInput = (value?: Date | string | null) => {
  if (!value) return undefined;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date?.getTime())) return undefined;
  return date.toISOString().split("T")[0];
};

const formatDateTimeForInput = (value?: Date | string | null) => {
  if (!value) return undefined;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date?.getTime())) return undefined;
  return date.toISOString().slice(0, 16);
};

const buildTaskFormValues = (
  currentTask: ContentTaskWithClient | null,
  initialScheduledAt?: Date | string
): TaskFormValues => {
  const scheduledValue = currentTask
    ? formatDateTimeForInput(currentTask.scheduledAt)
    : formatDateTimeForInput(initialScheduledAt);

  return {
    title: currentTask?.title ?? "",
    type: currentTask ? ensureTaskType(currentTask.type) : "REEL",
    status: currentTask ? ensureTaskStatus(currentTask.status) : "IDEA",
    priority: ensureTaskPriority((currentTask as any)?.priority),
    clientId: currentTask?.clientId ?? "",
    assignedEditorId: currentTask?.assignedEditorId ?? undefined,
    assignedCommunityId: currentTask?.assignedCommunityId ?? undefined,
    dueDate: formatDateForInput(currentTask?.dueDate) ?? undefined,
    scheduledAt: scheduledValue,
    postCopy: currentTask?.postCopy ?? undefined,
    coverImageUrl: currentTask?.coverImageUrl ?? undefined,
    audioBriefUrl: currentTask?.audioBriefUrl ?? undefined,
    shootId: undefined,
    reviewToken: undefined,
    clientFeedback: undefined,
    publishedAt: undefined,
  } as TaskFormValues;
};

interface TaskSheetProps {
  task: ContentTaskWithClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserWithTaskCount[];
  clients?: Array<{ id: string; name: string; logo?: string | null; color?: string | null }>;
  initialScheduledAt?: Date | string;
}

export function TaskSheet({ task, open, onOpenChange, users, clients = [], initialScheduledAt }: TaskSheetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<TaskMetrics | null>(null);
  const [enabledMetrics, setEnabledMetrics] = useState<string[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isSavingMetrics, setIsSavingMetrics] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedPostCopy, setCopiedPostCopy] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  const sortedClients = [...clients].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  const filteredClients = sortedClients.filter((client) => {
    const search = normalizeText(clientSearch).trim();
    if (!search) return true;
    return normalizeText(client.name).startsWith(search);
  });

  const isNewTask = !task;
  
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(isNewTask ? createContentTaskSchema : updateContentTaskSchema),
    defaultValues: buildTaskFormValues(task, initialScheduledAt),
  });

  const selectedClientId = form.watch("clientId");
  const selectedClient = filteredClients.find((c) => c.id === selectedClientId) || clients.find((c) => c.id === selectedClientId) || task?.client;

  // Formulario de métricas (ahora usa un objeto genérico para valores dinámicos)
  const metricsForm = useForm<any>({
    resolver: zodResolver(updateTaskMetricsSchema),
    defaultValues: {
      taskId: task?.id || "",
    },
  });

  // Cargar métricas y configuración del cliente cuando se abre una tarea existente
  useEffect(() => {
    if (task && open) {
      setIsLoadingMetrics(true);
      getTaskMetrics(task.id).then((result) => {
        if (result.success && result.data) {
          const { metrics: metricsData, enabledMetrics: enabled } = result.data;
          setMetrics(metricsData);
          setEnabledMetrics(enabled);
          
          // Construir valores por defecto basados en las métricas habilitadas
          const defaultValues: any = { taskId: task.id };
          
          // Valores de métricas existentes o 0 por defecto
          if (metricsData) {
            enabled.forEach((metricName) => {
              if (metricsData.hasOwnProperty(metricName)) {
                defaultValues[metricName] = metricsData[metricName as keyof TaskMetrics] || 0;
              } else {
                defaultValues[metricName] = 0;
              }
            });
          } else {
            // Si no hay métricas guardadas, inicializar con 0
            enabled.forEach((metricName) => {
              defaultValues[metricName] = 0;
            });
          }
          
          metricsForm.reset(defaultValues);
        } else {
          // Si no hay datos, cargar solo las métricas habilitadas del cliente
          getEnabledMetricsForClient(task.clientId).then((enabled) => {
            setEnabledMetrics(enabled);
            setMetrics(null);
            
            const defaultValues: any = { taskId: task.id };
            enabled.forEach((metricName) => {
              defaultValues[metricName] = 0;
            });
            metricsForm.reset(defaultValues);
          });
        }
        setIsLoadingMetrics(false);
      });
    } else if (!task) {
      // Resetear para nueva tarea
      setMetrics(null);
      setEnabledMetrics([]);
      metricsForm.reset({ taskId: "" });
    }
  }, [task, open, metricsForm]);

  // Resetear el formulario cuando cambia la tarea o se abre para crear nueva
  useEffect(() => {
    form.reset(buildTaskFormValues(task, initialScheduledAt));
    setClientSearch("");
  }, [task, form, initialScheduledAt]);

  const onSubmit = async (data: TaskFormValues) => {
    startTransition(async () => {
      try {
        const schema = isNewTask ? createContentTaskSchema : updateContentTaskSchema;
        const parsedData = schema.parse(data);

        // Calcular automáticamente la fecha de entrega: 24 horas antes de la fecha programada
        let calculatedDueDate: Date | undefined = undefined;
        if (parsedData.scheduledAt) {
          const scheduledDate = parsedData.scheduledAt instanceof Date
            ? parsedData.scheduledAt
            : new Date(parsedData.scheduledAt);
          calculatedDueDate = subHours(scheduledDate, 24);
        } else if (task?.scheduledAt && !parsedData.scheduledAt) {
          // Si se elimina la fecha programada, mantener la fecha de entrega actual o eliminarla
          calculatedDueDate = task.dueDate ? new Date(task.dueDate) : undefined;
        }

        // Preparar los datos con la fecha de entrega calculada
        const taskData = {
          ...parsedData,
          dueDate: calculatedDueDate ?? parsedData.dueDate,
        };

        let result;
        if (isNewTask) {
          // Crear nueva tarea
          result = await createTask(taskData as CreateContentTaskInput);
          if (result.success) {
            toast({
              title: "Tarea creada",
              description: `La tarea "${result.data?.title}" ha sido creada exitosamente.`,
            });
            // La UI se actualizará automáticamente gracias a revalidatePath
            router.refresh();
            onOpenChange(false);
          } else {
            toast({
              variant: "destructive",
              title: "Error al crear",
              description: result.error || "Ocurrió un error inesperado",
            });
          }
        } else {
          // Actualizar tarea existente
          if (!task) return;
          result = await updateTask(task.id, taskData as UpdateContentTaskInput);
          if (result.success) {
            toast({
              title: "Tarea actualizada",
              description: "Los cambios se han guardado correctamente.",
            });
            // Disparar evento personalizado para notificar que se actualizó la tarea
            window.dispatchEvent(new CustomEvent("taskUpdated", {
              detail: {
                taskId: task.id,
                status: parsedData.status,
              },
            }));
            // La UI se actualizará automáticamente gracias a revalidatePath
            router.refresh();
            onOpenChange(false);
          } else {
            toast({
              variant: "destructive",
              title: "Error al actualizar",
              description: result.error || "Ocurrió un error inesperado",
            });
          }
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: isNewTask ? "Error al crear" : "Error al actualizar",
          description:
            error instanceof Error
              ? error.message
              : "Ocurrió un error inesperado",
        });
      }
    });
  };

  const handleDelete = async () => {
    if (!task) return;

    setIsDeleting(true);

    try {
      const result = await deleteTask(task.id);

      if (result.success) {
        toast({
          title: "Tarea eliminada",
          description: "La tarea ha sido eliminada correctamente.",
        });
        router.refresh();
        onOpenChange(false);
        setShowDeleteDialog(false);
      } else {
        toast({
          variant: "destructive",
          title: "Error al eliminar",
          description: result.error || "Ocurrió un error inesperado",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al eliminar",
        description:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const onMetricsSubmit = async (data: any) => {
    if (!task) return;

    setIsSavingMetrics(true);

    try {
      // Construir el objeto de métricas con solo los campos habilitados
      const metricsData: any = {};
      enabledMetrics.forEach((metricName) => {
        metricsData[metricName] = data[metricName] ?? 0;
      });

      const result = await updateTaskMetrics({
        taskId: task.id,
        metrics: metricsData,
      });

      if (result.success && result.data) {
        setMetrics(result.data);
        toast({
          title: "Métricas guardadas",
          description: "Las métricas se han guardado correctamente.",
        });
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Error al guardar",
          description: result.error || "Ocurrió un error inesperado",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado",
      });
    } finally {
      setIsSavingMetrics(false);
    }
  };

  const handleCopySummary = async () => {
    if (!task || !metrics) return;

    const isReelOrStory = task.type === "REEL" || task.type === "STORY";
    
    // Construir resumen con las métricas disponibles
    let summary = `*Resultados de ${task.title}:*\n\n`;
    
    // Métricas Meta (si existen)
    if ((metrics.metaReach > 0 || metrics.metaViews > 0) && enabledMetrics.includes("metaViews")) {
      summary += `*Meta (IG/FB):* 🚀 ${metrics.metaViews || 0} vistas, ❤️ ${metrics.metaLikes || 0} likes, 💬 ${metrics.metaComments || 0} comentarios, ✈️ ${metrics.metaShares || 0} compartidos${isReelOrStory && enabledMetrics.includes("metaSaves") ? `, 💾 ${metrics.metaSaves || 0} guardados` : ""}${enabledMetrics.includes("metaReach") ? `, 👁️ ${metrics.metaReach || 0} alcance` : ""}\n`;
    }
    
    // Métricas TikTok (si existen)
    if (metrics.ttViews > 0 && enabledMetrics.includes("ttViews")) {
      summary += `*TikTok:* 🚀 ${metrics.ttViews || 0} vistas, ❤️ ${metrics.ttLikes || 0} likes, 💬 ${metrics.ttComments || 0} comentarios, ✈️ ${metrics.ttShares || 0} compartidos${isReelOrStory && enabledMetrics.includes("ttSaves") ? `, 💾 ${metrics.ttSaves || 0} guardados` : ""}\n`;
    }

    // Métricas de business impact (si existen)
    if (enabledMetrics.includes("conversions") && metrics.conversions > 0) {
      summary += `\n*Impacto de Negocio:*\n`;
      summary += `🔄 Conversiones: ${metrics.conversions}\n`;
      if (enabledMetrics.includes("salesCount") && metrics.salesCount > 0) {
        summary += `💰 Ventas: ${metrics.salesCount}\n`;
      }
      if (enabledMetrics.includes("revenue") && metrics.revenue > 0) {
        summary += `💵 Ingresos: $${metrics.revenue.toFixed(2)}\n`;
      }
      if (enabledMetrics.includes("conversionSource") && metrics.conversionSource) {
        summary += `📍 Fuente: ${metrics.conversionSource}\n`;
      }
    }

    try {
      await navigator.clipboard.writeText(summary);
      setCopiedSummary(true);
      toast({
        title: "Resumen copiado",
        description: "El resumen ha sido copiado al portapapeles.",
      });
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al copiar",
        description: "No se pudo copiar el resumen al portapapeles.",
      });
    }
  };

  // Usar métricas guardadas (el cálculo se hace en el backend)
  const displayMetrics = metrics;

  // Si es una nueva tarea y no hay initialScheduledAt, no mostrar el sheet
  if (!task && !initialScheduledAt && !open) return null;

  // Función helper para obtener el color del círculo de prioridad
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "LOW":
        return "bg-white border border-gray-300";
      case "MEDIUM":
        return "bg-green-500";
      case "HIGH":
        return "bg-orange-500";
      case "URGENT":
        return "bg-red-500";
      default:
        return "bg-gray-300";
    }
  };

  // Función helper para obtener el texto de prioridad
  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "LOW":
        return "Baja";
      case "MEDIUM":
        return "Media";
      case "HIGH":
        return "Alta";
      case "URGENT":
        return "Urgente";
      default:
        return priority;
    }
  };

  // Función helper para obtener las iniciales de un usuario
  const getUserInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Función helper para verificar si el brandDNA está completo
  const isBrandDNAComplete = (brandDNAString: string): boolean => {
    try {
      const brandDNA = JSON.parse(brandDNAString);
      const requiredFields = ["businessDescription", "toneOfVoice", "audience"];
      
      return requiredFields.every(field => {
        const value = brandDNA[field];
        return value && typeof value === "string" && value.trim().length > 0;
      });
    } catch {
      return false;
    }
  };

  // Función helper para obtener el error del brandDNA
  const getBrandDNAError = (brandDNAString: string): string => {
    try {
      const brandDNA = JSON.parse(brandDNAString);
      const missingFields: string[] = [];
      
      if (!brandDNA.businessDescription || brandDNA.businessDescription.trim().length === 0) {
        missingFields.push("Descripción del negocio");
      }
      if (!brandDNA.toneOfVoice || brandDNA.toneOfVoice.trim().length === 0) {
        missingFields.push("Tono de voz");
      }
      if (!brandDNA.audience || brandDNA.audience.trim().length === 0) {
        missingFields.push("Audiencia objetivo");
      }
      
      if (missingFields.length > 0) {
        return `Faltan campos en el ADN de marca: ${missingFields.join(", ")}`;
      }
      
      return "ADN de marca completo";
    } catch {
      return "ADN de marca inválido o corrupto";
    }
  };

  return (
    <TooltipProvider>
      <AnimatedModal
        open={open}
        onOpenChange={onOpenChange}
        title={isNewTask ? "Nueva Tarea" : "Editar Tarea"}
        description={isNewTask ? "Crea una nueva tarea de contenido." : "Modifica los detalles de la tarea de contenido."}
        className="w-[93vw] sm:w-[70vw] md:w-[56vw] lg:w-[48vw] xl:w-[42vw] max-w-3xl max-h-[90vh] p-0"
      >
        <div className="pl-12 pr-4 pt-12 pb-4 space-y-1 text-left md:text-center md:px-10 md:pt-10">
          <h2 className="text-2xl md:text-3xl font-semibold leading-tight">
            {isNewTask ? "Nueva Tarea" : "Editar Tarea"}
          </h2>
          <p className="text-base text-muted-foreground">
            {isNewTask ? "Crea una nueva tarea de contenido." : "Modifica los detalles de la tarea de contenido."}
          </p>
        </div>

        <div className="px-4 pb-4 md:px-10 md:pb-10 transition-[height,max-height] duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[height]">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Detalles</TabsTrigger>
              <TabsTrigger value="creative">Recursos Creativos</TabsTrigger>
              <TabsTrigger value="metrics">Métricas</TabsTrigger>
            </TabsList>

            {/* Tab Detalles */}
            <TabsContent value="details" className="mt-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem className="mb-6">
                        <FormLabel>Título</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Título de la tarea"
                            {...field}
                            disabled={isPending}
                            className="text-2xl font-medium border-0 border-b-2 border-input rounded-none px-0 pb-2 bg-transparent focus:border-primary"
                            style={{ fontSize: '1.5rem', fontWeight: '500' }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {clients.length > 0 && (
                    <FormField
                      control={form.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem className="mb-6 space-y-2">
                          <FormLabel className="text-sm font-medium leading-none">Cliente</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={!isNewTask || isPending}
                          >
                            <FormControl>
                              <SelectTrigger className="justify-start">
                                <div className="flex items-center gap-2 w-full truncate">
                                  {selectedClient ? (
                                    <>
                                      <Avatar className="h-7 w-7">
                                        <AvatarImage src={(selectedClient as any).logo || undefined} alt={(selectedClient as any).name} />
                                        <AvatarFallback className="bg-primary text-white text-xs font-medium">
                                          {(selectedClient as any).name?.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="truncate">{(selectedClient as any).name}</span>
                                    </>
                                  ) : (
                                    <SelectValue placeholder="Selecciona un cliente" />
                                  )}
                                </div>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <div className="px-3 pt-3 pb-2" onKeyDown={(e) => e.stopPropagation()}>
                                <Input
                                  placeholder="Buscar cliente"
                                  value={clientSearch}
                                  onChange={(e) => setClientSearch(e.target.value)}
                                  autoFocus
                                />
                              </div>
                              {filteredClients.map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-7 w-7">
                                      <AvatarImage src={client.logo || undefined} alt={client.name} />
                                      <AvatarFallback className="bg-primary text-white text-xs font-medium">
                                        {client.name.slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span>{client.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Fila 1: Tipo y Prioridad */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Contenido</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={isPending}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona el tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="REEL">Reel</SelectItem>
                              <SelectItem value="FLYER">Flyer</SelectItem>
                              <SelectItem value="STORY">Story</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prioridad</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || "MEDIUM"}
                            disabled={isPending}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona la prioridad" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((priority) => (
                                <SelectItem key={priority} value={priority}>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={cn(
                                        "h-3 w-3 rounded-full",
                                        getPriorityColor(priority)
                                      )}
                                    />
                                    <span>{getPriorityLabel(priority)}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Fila 2: Editor y Community */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="assignedEditorId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Editor Asignado</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                            value={field.value || "none"}
                            disabled={isPending}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un editor (opcional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Sin asignar</SelectItem>
                              {users.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-7 w-7">
                                      <AvatarImage src={user.image || undefined} alt={user.name} />
                                      <AvatarFallback className="text-xs font-semibold">
                                        {getUserInitials(user.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span>{user.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="assignedCommunityId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Community Asignado</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                            value={field.value || "none"}
                            disabled={isPending}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un community (opcional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Sin asignar</SelectItem>
                              {users.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-7 w-7">
                                      <AvatarImage src={user.image || undefined} alt={user.name} />
                                      <AvatarFallback className="text-xs font-semibold">
                                        {getUserInitials(user.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span>{user.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="scheduledAt"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className={task?.status === "CLIENT_APPROVED" ? "text-orange-600 font-semibold" : ""}>
                          Fecha Programada de Publicación
                          {task?.status === "CLIENT_APPROVED" && (
                            <span className="ml-2 text-xs text-orange-600">⚠️ No olvides programarla</span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            value={field.value || ""}
                            onChange={(e) => {
                              field.onChange(e.target.value || undefined);
                              // Calcular automáticamente la fecha de entrega cuando cambia la fecha programada
                              if (e.target.value) {
                                const scheduledDate = new Date(e.target.value);
                                const calculatedDueDate = subHours(scheduledDate, 24);
                                form.setValue("dueDate", calculatedDueDate.toISOString().split("T")[0]);
                              } else {
                                form.setValue("dueDate", undefined);
                              }
                            }}
                            disabled={isPending}
                            className={task?.status === "CLIENT_APPROVED" ? "border-orange-300 focus:border-orange-500 focus:ring-orange-500" : ""}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          La fecha de entrega se calculará automáticamente (24 horas antes de la publicación)
                        </p>
                      </FormItem>
                    )}
                  />

            </TabsContent>

            {/* Tab Recursos Creativos */}
            <TabsContent value="creative" className="mt-6">
                  {/* Copy con IA */}
                  <FormField
                    control={form.control}
                    name="postCopy"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Copy del Post</FormLabel>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={async () => {
                              const copyText = form.getValues("postCopy");
                              if (!copyText) {
                                toast({
                                  variant: "destructive",
                                  title: "Sin contenido",
                                  description: "No hay texto para copiar",
                                });
                                return;
                              }

                              try {
                                await navigator.clipboard.writeText(copyText);
                                setCopiedPostCopy(true);
                                toast({
                                  title: "Copiado 📋",
                                  description: "El texto se ha copiado al portapapeles",
                                  duration: 2000,
                                });
                                setTimeout(() => setCopiedPostCopy(false), 2000);
                              } catch (error) {
                                toast({
                                  variant: "destructive",
                                  title: "Error",
                                  description: "No se pudo copiar el texto",
                                });
                              }
                            }}
                            disabled={!field.value || isPending}
                          >
                            {copiedPostCopy ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <FormControl>
                          <div className="relative">
                            <Textarea
                              placeholder="Escribe el texto del post aquí..."
                              {...field}
                              disabled={isPending}
                              className="min-h-[120px] resize-y"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          Usa el botón de copiar para copiar el texto al portapapeles
                        </p>
                        
                        {/* IA Content Assistant */}
                        {task ? (
                          <AiContentAssistant
                            taskId={task.id}
                            currentCopy={field.value}
                            onInsertCopy={(content) => {
                              // Actualizar el valor del formulario sin disparar validación ni re-renders innecesarios
                              form.setValue("postCopy", content, {
                                shouldDirty: true,
                                shouldTouch: true,
                                shouldValidate: false,
                              });
                              // Enfocar el textarea después de insertar
                              setTimeout(() => {
                                const textarea = document.querySelector(
                                  'textarea[name="postCopy"]'
                                ) as HTMLTextAreaElement;
                                if (textarea) {
                                  textarea.focus();
                                  // Mover el cursor al final del texto
                                  const length = textarea.value.length;
                                  textarea.setSelectionRange(length, length);
                                }
                              }, 100);
                            }}
                            hasCompleteBrandDNA={task.client.brandDNA ? isBrandDNAComplete(task.client.brandDNA) : false}
                            brandDNAError={task.client.brandDNA ? getBrandDNAError(task.client.brandDNA) : "El cliente no tiene configurado el ADN de Marca"}
                          />
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-block w-full">
                                <Button 
                                  type="button"
                                  variant="outline" 
                                  className="w-full opacity-50 cursor-not-allowed"
                                  disabled={true}
                                >
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  Generar con IA
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Configura el ADN de Marca en el perfil del cliente para habilitar la IA</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </FormItem>
                    )}
                  />

                  {/* Imagen de Portada */}
                  <FormField
                    control={form.control}
                    name="coverImageUrl"
                    render={({ field }) => {
                      const hasImage = !!field.value && field.value !== "";
                      return (
                        <FormItem>
                          <FormLabel>Imagen de Portada</FormLabel>
                          <FormControl>
                            {hasImage ? (
                              <div className="relative rounded-lg border border-input overflow-hidden">
                                <div className="relative w-full h-64">
                                  <NextImage
                                    src={field.value}
                                    alt="Imagen de portada"
                                    fill
                                    className="object-cover"
                                  />
                                  <div className="absolute top-2 right-2 flex gap-2">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="icon"
                                      className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                                      asChild
                                    >
                                      <Link href={field.value} target="_blank" rel="noopener noreferrer">
                                        <Download className="h-4 w-4" />
                                      </Link>
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="icon"
                                      className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                                      onClick={() => {
                                        field.onChange("");
                                        toast({
                                          title: "Imagen eliminada",
                                          description: "Guarda cambios para confirmar.",
                                        });
                                      }}
                                      disabled={isPending}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex justify-center bg-gray-50">
                                <UploadButton
                                  endpoint="brandAsset"
                                  appearance={{
                                    button: "bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                                    allowedContent: "hidden"
                                  }}
                                  content={{ button: "Subir Portada" }}
                                  onClientUploadComplete={(res) => {
                                    console.log("✅ Archivos: ", res);
                                    if (res && res[0]) {
                                      const newUrl = res[0].ufsUrl || res[0].url;
                                      form.setValue("coverImageUrl", newUrl, {
                                        shouldDirty: true,
                                        shouldTouch: true,
                                        shouldValidate: true
                                      });
                                      toast({
                                        title: "Nueva imagen lista",
                                        description: "La imagen se ha subido correctamente",
                                      });
                                    }
                                  }}
                                  onUploadError={(error: Error) => {
                                    console.error("❌ Error subiendo:", error);
                                    toast({
                                      variant: "destructive",
                                      title: "Error al subir",
                                      description: `Error: ${error.message}`,
                                    });
                                  }}
                                />
                              </div>
                            )}
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
            </TabsContent>

            {/* Tab Métricas */}
            <TabsContent value="metrics" className="mt-6">
              {isLoadingMetrics ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  {enabledMetrics.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        Este cliente no tiene métricas configuradas en su perfil.
                      </p>
                    </div>
                  ) : (
                    <Form {...metricsForm}>
                      <form 
                        onSubmit={metricsForm.handleSubmit(onMetricsSubmit)} 
                        className="space-y-6"
                      >
                        {/* Grid de 2 columnas para inputs de métricas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {enabledMetrics.map((metricName) => {
                            // Mapear nombres amigables para las métricas
                            const metricLabels: Record<string, string> = {
                              metaViews: "Vistas Meta",
                              metaLikes: "Likes Meta",
                              metaShares: "Shares Meta",
                              metaComments: "Comentarios Meta",
                              metaSaves: "Guardados Meta",
                              metaReach: "Alcance Meta",
                              ttViews: "Vistas TikTok",
                              ttLikes: "Likes TikTok",
                              ttShares: "Shares TikTok",
                              ttComments: "Comentarios TikTok",
                              ttSaves: "Guardados TikTok",
                              totalBudgetSpent: "Presupuesto Gastado",
                              notes: "Notas",
                              conversions: "Conversiones",
                              salesCount: "Ventas",
                              revenue: "Ingresos",
                              conversionSource: "Fuente de Conversión",
                            };

                            const label = metricLabels[metricName] || metricName;

                            // Determinar el tipo de input
                            const isNumber = [
                              "metaViews", "metaLikes", "metaShares", "metaComments", "metaSaves", "metaReach",
                              "ttViews", "ttLikes", "ttShares", "ttComments", "ttSaves",
                              "totalBudgetSpent", "conversions", "salesCount", "revenue"
                            ].includes(metricName);

                            const isSelect = metricName === "conversionSource";

                            return (
                              <FormField
                                key={metricName}
                                control={metricsForm.control}
                                name={metricName}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{label}</FormLabel>
                                    <FormControl>
                                      {isSelect ? (
                                        <Select
                                          onValueChange={field.onChange}
                                          value={field.value || ""}
                                          disabled={isSavingMetrics}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Selecciona fuente" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                                            <SelectItem value="Web">Web</SelectItem>
                                            <SelectItem value="DM">DM</SelectItem>
                                            <SelectItem value="Link en Bio">Link en Bio</SelectItem>
                                            <SelectItem value="Local Físico">Local Físico</SelectItem>
                                            <SelectItem value="Otro">Otro</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      ) : isNumber ? (
                                        <Input
                                          type="number"
                                          min="0"
                                          step={metricName === "revenue" || metricName === "totalBudgetSpent" ? "0.01" : "1"}
                                          placeholder="0"
                                          {...field}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === "") {
                                              field.onChange(0);
                                            } else {
                                              const numValue = metricName === "revenue" || metricName === "totalBudgetSpent" 
                                                ? parseFloat(value) 
                                                : parseInt(value);
                                              field.onChange(isNaN(numValue) ? 0 : numValue);
                                            }
                                          }}
                                          value={field.value || ""}
                                          disabled={isSavingMetrics}
                                        />
                                      ) : (
                                        <Input
                                          type="text"
                                          placeholder="Escribe aquí..."
                                          {...field}
                                          value={field.value || ""}
                                          disabled={isSavingMetrics}
                                        />
                                      )}
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            );
                          })}
                        </div>

                        {/* Botón Guardar Métricas - Estilo corregido */}
                        <Button
                          type="submit"
                          disabled={isSavingMetrics}
                          className="w-full bg-user-color text-white hover:bg-user-color/90"
                          style={{ backgroundColor: 'var(--user-color, #2563eb)' }}
                        >
                          {isSavingMetrics ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Guardando...
                            </>
                          ) : (
                            "Guardar Métricas"
                          )}
                        </Button>
                      </form>
                    </Form>
                  )}
                </>
              )}

              {/* Análisis de Valor */}
              {task && displayMetrics && enabledMetrics.length > 0 && (
                <div className="mt-8 border-t pt-6">
                  {/* Cards de análisis */}
                </div>
              )}
            </TabsContent>
          </Tabs>

              {/* Botones finales */}
              <div className="flex flex-col gap-3 pt-6 border-t mt-6">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isNewTask ? "Creando..." : "Guardando..."}
                    </>
                  ) : (
                    isNewTask ? "Crear Tarea" : "Guardar Cambios"
                  )}
                </Button>

                {!isNewTask && (
                  <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full border-destructive text-destructive hover:bg-destructive/10"
                        disabled={isDeleting || isPending}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {isDeleting ? "Eliminando..." : "Eliminar Tarea"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>¿Estás seguro?</DialogTitle>
                        <DialogDescription>
                          Esta acción no se puede deshacer. La tarea será eliminada permanentemente.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowDeleteDialog(false)}
                          disabled={isDeleting}
                        >
                          Cancelar
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleDelete}
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Eliminando...
                            </>
                          ) : (
                            "Eliminar"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </form>
          </Form>
        </div>
      </AnimatedModal>
    </TooltipProvider>
  );
}
