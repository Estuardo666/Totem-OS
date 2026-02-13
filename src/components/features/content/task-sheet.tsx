"use client";

import { useState, useEffect, useTransition } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { subHours } from "date-fns";
import { Loader2, Trash2, Copy, Check, X, Download, Sparkles, Share2, FileText } from "lucide-react";
import { updateContentTaskSchema, createContentTaskSchema, type UpdateContentTaskInput, type CreateContentTaskInput, updateTaskMetricsSchema, type UpdateTaskMetricsInput } from "@/schemas/content";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import { updateTask, deleteTask, createTask, getTaskMetrics, updateTaskMetrics, getEnabledMetricsForClient } from "@/actions/content-actions";
import type { TaskMetrics, User } from "@prisma/client";
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
  
  // ✨ Usar getters locales (no UTC) para que el input datetime-local muestre correctamente
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const buildTaskFormValues = (
  currentTask: ContentTaskWithClient | null,
  initialScheduledAt?: Date | string,
  initialDefaults?: Partial<CreateTaskFormValues>
): TaskFormValues => {
  const scheduledValue = currentTask
    ? formatDateTimeForInput(currentTask.scheduledAt)
    : formatDateTimeForInput(initialScheduledAt);

  return {
    title: initialDefaults?.title ?? currentTask?.title ?? "",
    type: currentTask ? ensureTaskType(currentTask.type) : ensureTaskType(initialDefaults?.type),
    status: currentTask ? ensureTaskStatus(currentTask.status) : ensureTaskStatus(initialDefaults?.status),
    priority: ensureTaskPriority((currentTask as any)?.priority ?? initialDefaults?.priority),
    clientId: currentTask?.clientId ?? initialDefaults?.clientId ?? "",
    assignedEditorId: currentTask?.assignedEditorId ?? initialDefaults?.assignedEditorId ?? undefined,
    assignedCommunityId: currentTask?.assignedCommunityId ?? initialDefaults?.assignedCommunityId ?? undefined,
    dueDate: formatDateForInput(currentTask?.dueDate ?? (initialDefaults as any)?.dueDate) ?? undefined,
    scheduledAt: scheduledValue ?? (initialDefaults as any)?.scheduledAt,
    postCopy: currentTask?.postCopy ?? initialDefaults?.postCopy ?? undefined,
    coverImageUrl: currentTask?.coverImageUrl ?? initialDefaults?.coverImageUrl ?? undefined,
    audioBriefUrl: currentTask?.audioBriefUrl ?? initialDefaults?.audioBriefUrl ?? undefined,
    scriptUrl: currentTask?.scriptUrl ?? initialDefaults?.scriptUrl ?? undefined,
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
  users: (UserWithTaskCount | User)[];
  clients?: Array<{ id: string; name: string; logo?: string | null; color?: string | null }>;
  initialScheduledAt?: Date | string;
  initialDefaults?: Partial<CreateTaskFormValues>;
  disableClientSelector?: boolean;
}

export function TaskSheet({ task, open, onOpenChange, users, clients = [], initialScheduledAt, initialDefaults }: TaskSheetProps) {
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
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const sortedClients = [...clients].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  const filteredClients = sortedClients.filter((client) => {
    const search = normalizeText(clientSearch).trim();
    if (!search) return true;
    return normalizeText(client.name).startsWith(search);
  });

  const isNewTask = !task;
  
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(isNewTask ? createContentTaskSchema : updateContentTaskSchema),
    defaultValues: buildTaskFormValues(task, initialScheduledAt, initialDefaults),
  });

  const selectedClientId = form.watch("clientId");
  const coverImageUrl = form.watch("coverImageUrl");
  const scriptUrl = form.watch("scriptUrl");
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
    form.reset(buildTaskFormValues(task, initialScheduledAt, initialDefaults));
    setClientSearch("");
  }, [task, form, initialScheduledAt, initialDefaults]);

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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[93vw] sm:w-[70vw] md:w-[56vw] lg:w-[48vw] xl:w-[42vw] max-w-3xl max-h-[90vh] gap-4 border border-black/5 dark:border-white/10 bg-white dark:bg-background/5 dark:backdrop-blur-xl rounded-[2.5rem] shadow-2xl overflow-hidden p-6 transition-all duration-300 flex flex-col min-h-0">
          <DialogHeader className="pl-0 pr-0 pt-0 pb-4 space-y-1 text-center px-0">
            <DialogTitle className="text-2xl md:text-3xl font-semibold leading-tight">
              {isNewTask ? "Nueva Tarea" : "Editar Tarea"}
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              {isNewTask ? "Crea una nueva tarea de contenido." : "Modifica los detalles de la tarea de contenido."}
            </DialogDescription>
          </DialogHeader>

          <div className="px-0 pb-4 transition-[height,max-height] duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[height] overflow-y-auto max-h-[calc(90vh-180px)] pr-2 flex-1 min-h-0">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-12 items-center rounded-full bg-muted px-3 py-1 text-muted-foreground">
              <TabsTrigger value="details" className="rounded-full">Detalles</TabsTrigger>
              <TabsTrigger value="creative" className="rounded-full">Recursos Creativos</TabsTrigger>
              <TabsTrigger value="metrics" className="rounded-full">Métricas</TabsTrigger>
            </TabsList>

            {/* Tab Detalles */}
            <TabsContent value="details" className="mt-4 space-y-6">
              {/* SECCIÓN: Título y Cliente */}
              <div className="space-y-4">
                {/* Título */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Título</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Título de la tarea"
                          {...field}
                          disabled={isPending}
                          className="text-xl md:text-2xl font-semibold border border-input rounded-xl px-4 py-3 md:py-4 bg-white dark:bg-slate-950 focus:border-primary transition-all"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Cliente - Card prominente */}
                {clients.length > 0 && (
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!isNewTask || isPending}
                        >
                          <FormControl>
                            <SelectTrigger className={`justify-start rounded-xl px-4 py-3 md:py-4 border-2 transition-all ${selectedClient ? 'border-opacity-30 bg-opacity-5' : 'border-input'}`}
                              style={selectedClient ? {
                                borderColor: selectedClient.color || '#2563eb',
                                backgroundColor: `${selectedClient.color || '#2563eb'}0d`
                              } : undefined}
                            >
                              {selectedClient ? (
                                <div className="flex items-center gap-3 w-full">
                                  <div className="relative flex-shrink-0">
                                    <Avatar className="h-10 w-10 md:h-12 md:w-12 border-2" style={{ borderColor: selectedClient.color || '#2563eb' }}>
                                      {selectedClient.logo ? (
                                        <AvatarImage src={selectedClient.logo} alt={selectedClient.name} />
                                      ) : null}
                                      <AvatarFallback className="text-white text-sm font-bold" style={{ backgroundColor: selectedClient.color || '#2563eb' }}>
                                        {selectedClient.name?.slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{selectedClient.name}</p>
                                  </div>
                                </div>
                              ) : (
                                <SelectValue placeholder="Selecciona un cliente" className="text-muted-foreground" />
                              )}
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl">
                            <div className="px-3 py-3" onKeyDown={(e) => e.stopPropagation()}>
                              <Input
                                placeholder="Buscar cliente"
                                value={clientSearch}
                                onChange={(e) => setClientSearch(e.target.value)}
                                autoFocus
                                className="rounded-lg h-9"
                              />
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                              {filteredClients.map((client) => (
                                <SelectItem key={client.id} value={client.id} className="rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8 border" style={{ borderColor: client.color || '#2563eb' }}>
                                      {client.logo ? (
                                        <AvatarImage src={client.logo} alt={client.name} />
                                      ) : null}
                                      <AvatarFallback className="text-white text-xs font-bold" style={{ backgroundColor: client.color || '#2563eb' }}>
                                        {client.name.slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{client.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </div>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* SECCIÓN: Detalles Básicos - OCULTO */}
              <div className="hidden"></div>

              {/* SECCIÓN: Asignaciones */}
              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Asignaciones</h3>
                
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="assignedEditorId"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Editor Asignado</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                            value={field.value || "none"}
                            disabled={isPending}
                          >
                            <FormControl>
                              <SelectTrigger className="rounded-lg border-input">
                                {field.value !== "none" && field.value ? (
                                  <div className="flex items-center gap-2 w-full">
                                    {(() => {
                                      const user = users.find(u => u.id === field.value);
                                      return user ? (
                                        <>
                                          <Avatar className="h-8 w-8">
                                            <AvatarImage src={user.image || undefined} alt={user.name} />
                                            <AvatarFallback className="text-xs font-semibold bg-primary text-white">
                                              {getUserInitials(user.name)}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span className="truncate text-sm">{user.name}</span>
                                        </>
                                      ) : null;
                                    })()}
                                  </div>
                                ) : (
                                  <SelectValue placeholder="Sin asignar" />
                                )}
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="none" className="rounded-lg">Sin asignar</SelectItem>
                              {users.map((user) => (
                                <SelectItem key={user.id} value={user.id} className="rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-7 w-7">
                                      <AvatarImage src={user.image || undefined} alt={user.name} />
                                      <AvatarFallback className="text-xs font-semibold bg-primary text-white">
                                        {getUserInitials(user.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm">{user.name}</span>
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
                        <FormItem className="space-y-2">
                          <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Community Asignado</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                            value={field.value || "none"}
                            disabled={isPending}
                          >
                            <FormControl>
                              <SelectTrigger className="rounded-lg border-input">
                                {field.value !== "none" && field.value ? (
                                  <div className="flex items-center gap-2 w-full">
                                    {(() => {
                                      const user = users.find(u => u.id === field.value);
                                      return user ? (
                                        <>
                                          <Avatar className="h-8 w-8">
                                            <AvatarImage src={user.image || undefined} alt={user.name} />
                                            <AvatarFallback className="text-xs font-semibold bg-primary text-white">
                                              {getUserInitials(user.name)}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span className="truncate text-sm">{user.name}</span>
                                        </>
                                      ) : null;
                                    })()}
                                  </div>
                                ) : (
                                  <SelectValue placeholder="Sin asignar" />
                                )}
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="none" className="rounded-lg">Sin asignar</SelectItem>
                              {users.map((user) => (
                                <SelectItem key={user.id} value={user.id} className="rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-7 w-7">
                                      <AvatarImage src={user.image || undefined} alt={user.name} />
                                      <AvatarFallback className="text-xs font-semibold bg-primary text-white">
                                        {getUserInitials(user.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm">{user.name}</span>
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
                </div>

              {/* SECCIÓN: Fechas y Prioridad */}
              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cronograma</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="scheduledAt"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className={task?.status === "CLIENT_APPROVED" ? "text-orange-600 font-semibold text-xs uppercase tracking-wider" : "text-xs font-semibold uppercase tracking-wider text-muted-foreground"}>
                          Fecha de Entrega Interna
                          {task?.status === "CLIENT_APPROVED" && (
                            <span className="ml-2 text-xs text-orange-600 font-normal">⚠️ No olvides programarla</span>
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
                            className={`rounded-lg ${task?.status === "CLIENT_APPROVED" ? "border-orange-300 focus:border-orange-500 focus:ring-orange-500" : "border-input"}`}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          Fecha cuando debe estar lista la tarea para publicar
                        </p>
                      </FormItem>
                    )}
                  />

                  {/* Prioridad - OCULTO */}
                  <div className="hidden">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prioridad</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || "MEDIUM"}
                          disabled={isPending}
                        >
                          <FormControl>
                            <SelectTrigger className="rounded-lg border-input">
                              <SelectValue placeholder="Selecciona la prioridad" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="LOW" className="rounded-lg">🟢 Baja</SelectItem>
                            <SelectItem value="MEDIUM" className="rounded-lg">🟡 Media</SelectItem>
                            <SelectItem value="HIGH" className="rounded-lg">🟠 Alta</SelectItem>
                            <SelectItem value="URGENT" className="rounded-lg">🔴 Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  </div>
                </div>
              </div>

              {/* SECCIÓN: Estado - OCULTO */}
              <div className="hidden">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estado</h3>
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estado de la Tarea</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isPending}
                      >
                        <FormControl>
                          <SelectTrigger className="rounded-lg border-input">
                            <SelectValue placeholder="Selecciona el estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="IDEA" className="rounded-lg">💡 Idea</SelectItem>
                          <SelectItem value="RECORDED" className="rounded-lg">🎥 Grabado</SelectItem>
                          <SelectItem value="EDITING" className="rounded-lg">✏️ Editando</SelectItem>
                          <SelectItem value="REVIEW_INTERNAL" className="rounded-lg">👀 Revisión Interna</SelectItem>
                          <SelectItem value="REVIEW_CLIENT" className="rounded-lg">📋 Revisión Cliente</SelectItem>
                          <SelectItem value="CLIENT_APPROVED" className="rounded-lg">✅ Aprobado Cliente</SelectItem>
                          <SelectItem value="APPROVED" className="rounded-lg">✅ Aprobado</SelectItem>
                          <SelectItem value="PUBLISHED" className="rounded-lg">🚀 Publicado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </TabsContent>

            {/* Tab Recursos Creativos */}
            <TabsContent value="creative" className="mt-4 space-y-6">
                  {/* SECCIÓN: Copy del Post */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Texto del Post</h3>
                    <FormField
                      control={form.control}
                      name="postCopy"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Copy</FormLabel>
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
                            <Textarea
                              placeholder="Escribe el texto del post aquí..."
                              {...field}
                              disabled={isPending}
                              className="min-h-[140px] resize-y rounded-lg border-input"
                            />
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
                                form.setValue("postCopy", content, {
                                  shouldDirty: true,
                                  shouldTouch: true,
                                  shouldValidate: false,
                                });
                                setTimeout(() => {
                                  const textarea = document.querySelector(
                                    'textarea[name="postCopy"]'
                                  ) as HTMLTextAreaElement;
                                  if (textarea) {
                                    textarea.focus();
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
                  </div>

                  {/* SECCIÓN: Imagen de Portada */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recursos Visuales</h3>
                    <FormField
                      control={form.control}
                      name="coverImageUrl"
                      render={({ field }) => {
                        const hasImage = !!coverImageUrl && coverImageUrl !== "";
                        return (
                          <FormItem className="space-y-2">
                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Imagen de Portada</FormLabel>
                            <FormControl>
                              {hasImage ? (
                                <div className="relative rounded-xl border border-input overflow-hidden">
                                  <div className="relative w-full h-64 md:h-80">
                                    <NextImage
                                      src={coverImageUrl}
                                      alt="Imagen de portada"
                                      fill
                                      className="object-cover"
                                    />
                                    <div className="absolute top-3 right-3 flex gap-2">
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="icon"
                                        className="h-10 w-10 bg-background/90 hover:bg-background backdrop-blur-md rounded-lg"
                                        asChild
                                      >
                                        <Link href={coverImageUrl} target="_blank" rel="noopener noreferrer">
                                          <Download className="h-5 w-5" />
                                        </Link>
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="h-10 w-10 bg-red-500/90 hover:bg-red-600 backdrop-blur-md rounded-lg"
                                        onClick={() => {
                                          field.onChange("");
                                          toast({
                                            title: "Imagen eliminada",
                                            description: "Guarda cambios para confirmar.",
                                          });
                                        }}
                                        disabled={isPending}
                                      >
                                        <X className="h-5 w-5" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 flex flex-col items-center justify-center gap-4 bg-muted/30 relative hover:border-muted-foreground/50 transition-colors">
                                  {isUploadingImage && (
                                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center gap-3 z-10">
                                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                      <p className="text-sm font-medium text-muted-foreground">Subiendo imagen...</p>
                                    </div>
                                  )}
                                  <UploadButton
                                    endpoint="brandAsset"
                                    appearance={{
                                      button: "bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                                      allowedContent: "hidden"
                                    }}
                                    content={{ button: "Subir Portada" }}
                                    onUploadBegin={() => {
                                      setIsUploadingImage(true);
                                    }}
                                    onClientUploadComplete={(res) => {
                                      setIsUploadingImage(false);
                                      console.log("✅ Archivos: ", res);
                                      if (res && res[0]) {
                                        const newUrl = res[0].ufsUrl || res[0].url;
                                        form.setValue("coverImageUrl", newUrl, {
                                          shouldDirty: true,
                                          shouldTouch: true,
                                          shouldValidate: true
                                        });
                                        toast({
                                          title: "✅ Imagen subida",
                                          description: "La imagen se ha subido correctamente",
                                        });
                                      }
                                    }}
                                    onUploadError={(error: Error) => {
                                      setIsUploadingImage(false);
                                      console.error("❌ Error subiendo:", error);
                                      toast({
                                        variant: "destructive",
                                        title: "❌ Error al subir",
                                        description: error.message,
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
                  </div>

                  {/* Guión del contenido */}
                  <FormField
                    control={form.control}
                    name="scriptUrl"
                    render={({ field }) => {
                      const hasScript = !!scriptUrl && scriptUrl !== "";
                      const getFileExtension = (url: string) => {
                        const match = url.match(/\.([^./?#]+)(?:[?#]|$)/i);
                        return match ? match[1].toUpperCase() : 'DOC';
                      };
                      const getFileName = (url: string) => {
                        try {
                          const urlObj = new URL(url);
                          const pathname = urlObj.pathname;
                          const segments = pathname.split('/');
                          return decodeURIComponent(segments[segments.length - 1]);
                        } catch {
                          return 'documento';
                        }
                      };
                      
                      return (
                        <div className="space-y-3">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Documentos</h3>
                          <FormItem className="space-y-2">
                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Guión del Contenido</FormLabel>
                            <FormControl>
                              {hasScript ? (
                                <div className="border border-input rounded-xl p-4 bg-muted/50 hover:bg-muted/70 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                                      <FileText className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">
                                        {getFileName(scriptUrl)}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {getFileExtension(scriptUrl)}
                                      </p>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 hover:bg-background"
                                        asChild
                                      >
                                        <Link href={scriptUrl} target="_blank" rel="noopener noreferrer">
                                          <Download className="h-5 w-5" />
                                        </Link>
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 hover:bg-background"
                                        onClick={async () => {
                                          try {
                                            await navigator.clipboard.writeText(scriptUrl);
                                            toast({
                                              title: "Link copiado",
                                              description: "El enlace del guión se copió al portapapeles",
                                            });
                                          } catch (error) {
                                            toast({
                                              variant: "destructive",
                                              title: "Error",
                                              description: "No se pudo copiar el enlace",
                                            });
                                          }
                                        }}
                                      >
                                        <Copy className="h-5 w-5" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="h-9 w-9 bg-red-600/90 hover:bg-red-700"
                                        onClick={() => {
                                          field.onChange("");
                                          toast({
                                            title: "Guión eliminado",
                                            description: "Guarda cambios para confirmar.",
                                          });
                                        }}
                                        disabled={isPending}
                                      >
                                        <X className="h-5 w-5" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 flex justify-center bg-muted/30 hover:border-muted-foreground/50 transition-colors">
                                  <UploadButton
                                    endpoint="brandAsset"
                                    appearance={{
                                      button: "bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                                      allowedContent: "hidden"
                                    }}
                                    content={{ button: "Subir Guión" }}
                                    onClientUploadComplete={(res) => {
                                      console.log("✅ Guión subido: ", res);
                                      if (res && res[0]) {
                                        const newUrl = res[0].url;
                                        form.setValue("scriptUrl", newUrl, {
                                          shouldDirty: true,
                                          shouldTouch: true,
                                          shouldValidate: true
                                        });
                                        toast({
                                          title: "Guión subido",
                                          description: "El archivo se ha subido correctamente",
                                        });
                                      }
                                    }}
                                    onUploadError={(error: Error) => {
                                      console.error("❌ Error subiendo guión:", error);
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
                        </div>
                      );
                    }}
                  />
            </TabsContent>

            {/* Tab Métricas */}
            <TabsContent value="metrics" className="mt-4 space-y-6">
              {isLoadingMetrics ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {enabledMetrics.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <p className="text-muted-foreground text-sm">
                        Este cliente no tiene métricas configuradas en su perfil.
                      </p>
                    </div>
                  ) : (
                    <Form {...metricsForm}>
                      <form className="space-y-6">
                        {/* SECCIÓN: Métricas */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rendimiento</h3>
                          
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
                                  <FormItem className="space-y-2">
                                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</FormLabel>
                                    <FormControl>
                                      {isSelect ? (
                                        <Select
                                          onValueChange={field.onChange}
                                          value={field.value || ""}
                                          disabled={isSavingMetrics}
                                        >
                                          <SelectTrigger className="rounded-lg border-input">
                                            <SelectValue placeholder="Selecciona fuente" />
                                          </SelectTrigger>
                                          <SelectContent className="rounded-xl">
                                            <SelectItem value="WhatsApp" className="rounded-lg">WhatsApp</SelectItem>
                                            <SelectItem value="Web" className="rounded-lg">Web</SelectItem>
                                            <SelectItem value="DM" className="rounded-lg">DM</SelectItem>
                                            <SelectItem value="Link en Bio" className="rounded-lg">Link en Bio</SelectItem>
                                            <SelectItem value="Local Físico" className="rounded-lg">Local Físico</SelectItem>
                                            <SelectItem value="Otro" className="rounded-lg">Otro</SelectItem>
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
                                          className="rounded-lg border-input"
                                        />
                                      ) : (
                                        <Input
                                          type="text"
                                          placeholder="Escribe aquí..."
                                          {...field}
                                          value={field.value || ""}
                                          disabled={isSavingMetrics}
                                          className="rounded-lg border-input"
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
                        </div>

                        {/* Botón Guardar Métricas */}
                        <div className="flex gap-3 pt-4">
                          <Button
                            type="button"
                            onClick={() => metricsForm.handleSubmit(onMetricsSubmit)()}
                            disabled={isSavingMetrics}
                            className="flex-1 bg-primary text-white hover:bg-primary/90 rounded-lg h-10 font-medium"
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
                        </div>
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
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  );
}
