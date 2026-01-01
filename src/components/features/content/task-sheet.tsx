"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { subHours } from "date-fns";
import { Loader2, Trash2, Copy, Check, Image, FileText, Palette, ExternalLink, MessageSquare, Brain, TrendingUp, X, Download } from "lucide-react";
import { updateContentTaskSchema, createContentTaskSchema, type UpdateContentTaskInput, type CreateContentTaskInput, updateTaskMetricsSchema, type UpdateTaskMetricsInput } from "@/schemas/content";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import { updateTask, deleteTask, createTask, getTaskMetrics, updateTaskMetrics } from "@/actions/content-actions";
import type { TaskMetrics } from "@prisma/client";
import type { UserWithTaskCount } from "@/actions/user.actions";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { UploadButton } from "@uploadthing/react";
import NextImage from "next/image";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { AudioRecorder } from "@/components/ui/audio-recorder";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateBrandLoyalty, calculateInvestmentEfficiency, formatCurrency } from "@/lib/metrics-calculations";
import { cn } from "@/lib/utils";
import { AiContentAssistant } from "@/components/features/ai/ai-content-assistant";

interface TaskSheetProps {
  task: ContentTaskWithClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserWithTaskCount[];
  clients?: Array<{ id: string; name: string }>;
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
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isSavingMetrics, setIsSavingMetrics] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedPostCopy, setCopiedPostCopy] = useState(false);

  const isNewTask = !task;
  
  const form = useForm<UpdateContentTaskInput | CreateContentTaskInput>({
    resolver: zodResolver(isNewTask ? createContentTaskSchema : updateContentTaskSchema),
    defaultValues: {
      title: task?.title || "",
      type: task?.type || "REEL",
      status: task?.status || "IDEA",
      clientId: task?.clientId || "",
      assignedToId: task?.assignedToId || undefined,
      dueDate: task?.dueDate
        ? typeof task.dueDate === "string"
          ? task.dueDate.split("T")[0]
          : new Date(task.dueDate).toISOString().split("T")[0]
        : undefined,
      scheduledAt: task?.scheduledAt
        ? typeof task.scheduledAt === "string"
          ? new Date(task.scheduledAt).toISOString().slice(0, 16)
          : new Date(task.scheduledAt).toISOString().slice(0, 16)
        : undefined,
      postCopy: task?.postCopy || undefined,
      coverImageUrl: task?.coverImageUrl || undefined,
      audioBriefUrl: task?.audioBriefUrl || undefined,
    },
  });

  // Formulario de métricas
  const metricsForm = useForm<UpdateTaskMetricsInput>({
    resolver: zodResolver(updateTaskMetricsSchema),
    defaultValues: {
      taskId: task?.id || "",
      // Meta
      metaViews: 0,
      metaLikes: 0,
      metaShares: 0,
      metaComments: 0,
      metaSaves: 0,
      metaReach: 0,
      // TikTok
      ttViews: 0,
      ttLikes: 0,
      ttShares: 0,
      ttComments: 0,
      ttSaves: 0,
      // Globales
      totalBudgetSpent: null,
      notes: null,
      // Business Impact
      conversions: 0,
      salesCount: 0,
      revenue: 0.0,
      conversionSource: null,
    },
  });

  // Cargar métricas cuando se abre una tarea existente
  useEffect(() => {
    if (task && open) {
      setIsLoadingMetrics(true);
      getTaskMetrics(task.id).then((result) => {
        if (result.success && result.data) {
          setMetrics(result.data);
          metricsForm.reset({
            taskId: task.id,
            // Meta
            metaViews: result.data.metaViews || 0,
            metaLikes: result.data.metaLikes || 0,
            metaShares: result.data.metaShares || 0,
            metaComments: result.data.metaComments || 0,
            metaSaves: result.data.metaSaves || 0,
            metaReach: result.data.metaReach || 0,
            // TikTok
            ttViews: result.data.ttViews || 0,
            ttLikes: result.data.ttLikes || 0,
            ttShares: result.data.ttShares || 0,
            ttComments: result.data.ttComments || 0,
            ttSaves: result.data.ttSaves || 0,
            // Globales
            totalBudgetSpent: result.data.totalBudgetSpent || null,
            notes: result.data.notes || null,
            // Business Impact
            conversions: result.data.conversions || 0,
            salesCount: result.data.salesCount || 0,
            revenue: result.data.revenue || 0.0,
            conversionSource: result.data.conversionSource || null,
          });
        } else {
          // Si no hay métricas, inicializar con valores por defecto
          setMetrics(null);
          metricsForm.reset({
            taskId: task.id,
            metaViews: 0,
            metaLikes: 0,
            metaShares: 0,
            metaComments: 0,
            metaSaves: 0,
            metaReach: 0,
            ttViews: 0,
            ttLikes: 0,
            ttShares: 0,
            ttComments: 0,
            ttSaves: 0,
            totalBudgetSpent: null,
            notes: null,
            conversions: 0,
            salesCount: 0,
            revenue: 0.0,
            conversionSource: null,
          });
        }
        setIsLoadingMetrics(false);
      });
    } else if (!task) {
      // Resetear métricas para nueva tarea
      setMetrics(null);
      metricsForm.reset({
        taskId: "",
        metaViews: 0,
        metaLikes: 0,
        metaShares: 0,
        metaComments: 0,
        metaSaves: 0,
        metaReach: 0,
        ttViews: 0,
        ttLikes: 0,
        ttShares: 0,
        ttComments: 0,
        ttSaves: 0,
        totalBudgetSpent: null,
        notes: null,
        conversions: 0,
        salesCount: 0,
        revenue: 0.0,
        conversionSource: null,
      });
    }
  }, [task, open, metricsForm]);

  // Resetear el formulario cuando cambia la tarea o se abre para crear nueva
  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        type: task.type,
        status: task.status,
        priority: (task as any).priority || "MEDIUM",
        clientId: task.clientId,
        assignedToId: task.assignedToId || undefined,
        dueDate: task.dueDate
          ? typeof task.dueDate === "string"
            ? task.dueDate.split("T")[0]
            : new Date(task.dueDate).toISOString().split("T")[0]
          : undefined,
        scheduledAt: task.scheduledAt
          ? typeof task.scheduledAt === "string"
            ? new Date(task.scheduledAt).toISOString().slice(0, 16)
            : new Date(task.scheduledAt).toISOString().slice(0, 16)
          : undefined,
        postCopy: task.postCopy || undefined,
        coverImageUrl: task.coverImageUrl || undefined,
        audioBriefUrl: task.audioBriefUrl || undefined,
      });
    } else {
      // Resetear para nueva tarea
      const scheduledAtValue = initialScheduledAt
        ? typeof initialScheduledAt === "string"
          ? new Date(initialScheduledAt).toISOString().slice(0, 16)
          : new Date(initialScheduledAt).toISOString().slice(0, 16)
        : undefined;
      
      form.reset({
        title: "",
        type: "REEL",
        status: "IDEA",
        priority: "MEDIUM",
        clientId: "",
        assignedToId: undefined,
        dueDate: undefined,
        scheduledAt: scheduledAtValue,
        postCopy: undefined,
        coverImageUrl: undefined,
        audioBriefUrl: undefined,
      });
    }
  }, [task, form, initialScheduledAt]);

  const onSubmit = async (data: UpdateContentTaskInput | CreateContentTaskInput) => {
    startTransition(async () => {
      try {
        // Calcular automáticamente la fecha de entrega: 24 horas antes de la fecha programada
        let calculatedDueDate: Date | undefined = undefined;
        if (data.scheduledAt) {
          const scheduledDate = typeof data.scheduledAt === "string" 
            ? new Date(data.scheduledAt) 
            : data.scheduledAt;
          calculatedDueDate = subHours(scheduledDate, 24);
        } else if (task?.scheduledAt && !data.scheduledAt) {
          // Si se elimina la fecha programada, mantener la fecha de entrega actual o eliminarla
          calculatedDueDate = task.dueDate ? new Date(task.dueDate) : undefined;
        }

        // Preparar los datos con la fecha de entrega calculada
        const taskData = {
          ...data,
          dueDate: calculatedDueDate !== undefined ? calculatedDueDate : data.dueDate,
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
                status: (data as UpdateContentTaskInput).status,
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

  const onMetricsSubmit = async (data: UpdateTaskMetricsInput) => {
    if (!task) return;

    setIsSavingMetrics(true);

    try {
      const result = await updateTaskMetrics({
        ...data,
        taskId: task.id,
      });

      if (result.success) {
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
    if (!task) return;

    const metricsData = metricsForm.getValues();
    const isReelOrStory = task.type === "REEL" || task.type === "STORY";
    
    // Construir resumen con métricas de ambas plataformas
    let summary = `*Resultados de ${task.title}:*\n\n`;
    
    if (metricsData.metaReach > 0 || metricsData.metaViews > 0) {
      summary += `*Meta (IG/FB):* 🚀 ${metricsData.metaViews || 0} vistas, ❤️ ${metricsData.metaLikes || 0} likes, 💬 ${metricsData.metaComments || 0} comentarios, ✈️ ${metricsData.metaShares || 0} compartidos${isReelOrStory ? `, 💾 ${metricsData.metaSaves || 0} guardados` : ""}, 👁️ ${metricsData.metaReach || 0} alcance\n`;
    }
    
    if (metricsData.ttViews > 0) {
      summary += `*TikTok:* 🚀 ${metricsData.ttViews || 0} vistas, ❤️ ${metricsData.ttLikes || 0} likes, 💬 ${metricsData.ttComments || 0} comentarios, ✈️ ${metricsData.ttShares || 0} compartidos${isReelOrStory ? `, 💾 ${metricsData.ttSaves || 0} guardados` : ""}\n`;
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

  // Observar los valores del formulario de métricas en tiempo real
  const watchedMetrics = useWatch({
    control: metricsForm.control,
    defaultValue: {
      metaViews: 0,
      metaLikes: 0,
      metaShares: 0,
      metaComments: 0,
      metaSaves: 0,
      metaReach: 0,
      ttViews: 0,
      ttLikes: 0,
      ttShares: 0,
      ttComments: 0,
      ttSaves: 0,
    },
  });

  // Calcular métricas en tiempo real basándose en los valores del formulario
  const currentMetrics = useMemo(() => {
    if (!task) return null;
    
    const metaViews = watchedMetrics.metaViews || 0;
    const metaLikes = watchedMetrics.metaLikes || 0;
    const metaComments = watchedMetrics.metaComments || 0;
    const metaShares = watchedMetrics.metaShares || 0;
    const metaSaves = watchedMetrics.metaSaves || 0;
    const metaReach = watchedMetrics.metaReach || 0;
    
    const ttViews = watchedMetrics.ttViews || 0;
    const ttLikes = watchedMetrics.ttLikes || 0;
    const ttComments = watchedMetrics.ttComments || 0;
    const ttShares = watchedMetrics.ttShares || 0;
    const ttSaves = watchedMetrics.ttSaves || 0;
    
    // Calcular ER Meta
    const metaTotalEngagement = metaLikes + metaComments + metaShares + metaSaves;
    const erMeta = metaReach > 0 ? (metaTotalEngagement / metaReach) * 100 : 0;
    
    // Calcular ER TikTok
    const ttTotalEngagement = ttLikes + ttComments + ttShares + ttSaves;
    const erTikTok = ttViews > 0 ? (ttTotalEngagement / ttViews) * 100 : 0;
    
    return {
      metaViews,
      metaLikes,
      metaComments,
      metaShares,
      metaSaves,
      metaReach,
      ttViews,
      ttLikes,
      ttComments,
      ttShares,
      ttSaves,
      erMeta,
      erTikTok,
    } as TaskMetrics & { erMeta: number; erTikTok: number };
  }, [watchedMetrics, task]);

  // Usar métricas actuales del formulario o las guardadas
  const displayMetrics = currentMetrics || metrics;

  // Si es una nueva tarea y no hay initialScheduledAt, no mostrar el sheet
  if (!task && !initialScheduledAt && !open) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          className="w-full sm:max-w-2xl overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <SheetHeader>
            <SheetTitle>{isNewTask ? "Nueva Tarea" : "Editar Tarea"}</SheetTitle>
            <SheetDescription>
              {isNewTask 
                ? "Crea una nueva tarea de contenido." 
                : "Modifica los detalles de la tarea de contenido."}
            </SheetDescription>
          </SheetHeader>

          {!isNewTask ? (
            <Tabs defaultValue="details" className="mt-6">
              <TabsList className={cn(
                "grid w-full",
                task.status === "PUBLISHED" ? "grid-cols-2" : "grid-cols-1"
              )}>
                <TabsTrigger value="details">Detalles</TabsTrigger>
                {task.status === "PUBLISHED" && (
                  <TabsTrigger value="metrics">Métricas</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="details" className="mt-6">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="flex flex-col h-full relative"
                  >
              <div className="flex-1 overflow-y-auto py-4 px-1 space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Título de la tarea"
                          {...field}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Campo de Cliente solo para nuevas tareas */}
                {isNewTask && clients.length > 0 && (
                  <FormField
                    control={form.control}
                    name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Tipo de Contenido</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
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
                    <FormItem className="flex-1">
                      <FormLabel>Prioridad</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value || "MEDIUM"}
                        disabled={isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona la prioridad" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="LOW">Baja</SelectItem>
                          <SelectItem value="MEDIUM">Media</SelectItem>
                          <SelectItem value="HIGH">Alta</SelectItem>
                          <SelectItem value="URGENT">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assignedToId"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Asignar a</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                        value={field.value || "none"}
                        disabled={isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un usuario (opcional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin asignar</SelectItem>
                          {users.map((user) => {
                            const taskCount = user._count?.tasks || 0;
                            
                            // Lógica de colores según carga de trabajo
                            const getBadgeColor = (count: number) => {
                              if (count === 0) {
                                return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
                              }
                              if (count >= 10) {
                                return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
                              }
                              if (count >= 5) {
                                return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
                              }
                              return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
                            };

                            return (
                              <SelectItem key={user.id} value={user.id}>
                                <div className="flex justify-between items-center w-full">
                                  <span>{user.name}</span>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs rounded-full px-2 py-0.5 ${getBadgeColor(taskCount)}`}
                                  >
                                    {taskCount}
                                  </Badge>
                                </div>
                              </SelectItem>
                            );
                          })}
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
                  <FormItem>
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

                <Separator className="my-6" />

                {/* Sección de Recursos Creativos */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Recursos Creativos</h3>
                  </div>

                  {/* Campo de Copy */}
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
                      {task && (() => {
                        // Extraer y validar ADN de marca del cliente
                        let hasCompleteBrandDNA = false;
                        let brandDNAError = "";

                        // Debug: Log completo del cliente para diagnóstico
                        console.log("[AI Debug] Client Data:", {
                          clientId: task.client.id,
                          clientName: task.client.name,
                          brandDNA: task.client.brandDNA,
                          brandDNAType: typeof task.client.brandDNA,
                          brandDNAExists: !!task.client.brandDNA,
                          fullClientKeys: Object.keys(task.client),
                        });

                        // Extraer brandDNA del string JSON almacenado en la base de datos
                        let parsedBrandDNA: {
                          businessDescription?: string;
                          toneOfVoice?: string;
                          audience?: string;
                          values?: string;
                          prohibitedTopics?: string;
                        } = {};

                        const brandDNAString = task.client.brandDNA;
                        
                        // Verificar si brandDNA existe y es un string válido
                        if (brandDNAString && typeof brandDNAString === "string" && brandDNAString.trim() !== "" && brandDNAString !== "null") {
                          try {
                            parsedBrandDNA = JSON.parse(brandDNAString);
                            console.log("[AI Assistant] ✅ BrandDNA parseado correctamente:", parsedBrandDNA);
                          } catch (error) {
                            console.error("[AI Assistant] ❌ Error al parsear brandDNA:", error, brandDNAString);
                            hasCompleteBrandDNA = false;
                            brandDNAError = `Error al leer el ADN de marca del cliente: ${error instanceof Error ? error.message : "Error desconocido"}. Por favor, verifica la configuración del cliente.`;
                          }
                        } else {
                          console.log("[AI Assistant] ⚠️ No brandDNA encontrado o vacío. Value:", brandDNAString);
                          hasCompleteBrandDNA = false;
                          brandDNAError = "El cliente no tiene ADN de marca configurado. Por favor, completa la información en el perfil del cliente (pestaña 'Estrategia de Marca') antes de usar las funciones de IA.";
                        }

                        // Validar que los campos requeridos estén presentes y no vacíos
                        if (Object.keys(parsedBrandDNA).length > 0) {
                          const businessDesc = (parsedBrandDNA.businessDescription || "").trim();
                          const toneOfVoice = (parsedBrandDNA.toneOfVoice || "").trim();
                          const audience = (parsedBrandDNA.audience || "").trim();
                          
                          console.log("[AI Assistant] Validación de campos:", {
                            businessDesc: businessDesc.length > 0 ? `✅ (${businessDesc.length} chars)` : "❌ vacío",
                            toneOfVoice: toneOfVoice.length > 0 ? `✅ (${toneOfVoice})` : "❌ vacío",
                            audience: audience.length > 0 ? `✅ (${audience.length} chars)` : "❌ vacío",
                          });
                          
                          const hasBusinessDescription = businessDesc.length > 0;
                          const hasToneOfVoice = toneOfVoice.length > 0;
                          const hasAudience = audience.length > 0;

                          hasCompleteBrandDNA = hasBusinessDescription && hasToneOfVoice && hasAudience;

                          if (!hasCompleteBrandDNA) {
                            const missingFields: string[] = [];
                            if (!hasBusinessDescription) missingFields.push("Descripción del negocio");
                            if (!hasToneOfVoice) missingFields.push("Tono de voz");
                            if (!hasAudience) missingFields.push("Audiencia objetivo");
                            brandDNAError = `El ADN de marca del cliente no está completo. Faltan: ${missingFields.join(", ")}. Por favor, completa esta información en el perfil del cliente (pestaña "Estrategia de Marca") antes de usar las funciones de IA.`;
                          } else {
                            console.log("[AI Assistant] ✅✅✅ BrandDNA completo y válido - Listo para usar IA");
                          }
                        }

                        return (
                          <div className="mt-4 pt-4 border-t">
                            <AiContentAssistant
                              taskId={task.id}
                              currentCopy={field.value}
                              currentScript={form.getValues("postCopy")} // Asumiendo que script es el mismo campo por ahora
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
                              hasCompleteBrandDNA={hasCompleteBrandDNA}
                              brandDNAError={brandDNAError}
                            />
                          </div>
                        );
                      })()}
                    </FormItem>
                  )}
                />

                {/* Campo de Imagen de Portada */}
                <FormField
                  control={form.control}
                  name="coverImageUrl"
                  render={({ field }) => {
                    // Verificar si hay un valor válido
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
                                    // Establecer el valor a una cadena vacía para que React Hook Form lo maneje correctamente
                                    // El esquema Zod convertirá esto a null en el servidor
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
                                  const newUrl = res[0].ufsUrl || res[0].url; // Usa ufsUrl, con fallback a url
                                  // Actualiza el estado local "en caliente" para mostrar la nueva imagen inmediatamente
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

                  {/* Campo de Nota de Voz (Totem Voice) */}
                  <FormField
                    control={form.control}
                    name="audioBriefUrl"
                    render={({ field }) => {
                      // Verificar si hay un valor válido
                      const hasAudio = !!field.value && field.value !== "";
                      
                      return (
                        <FormItem>
                          <FormLabel>Nota de Voz (Totem Voice)</FormLabel>
                          <FormControl>
                            {hasAudio ? (
                              <div className="space-y-3 rounded-lg border border-input bg-background p-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">Nota de voz guardada</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      field.onChange("");
                                      toast({
                                        title: "Nota eliminada",
                                        description: "Guarda cambios para confirmar.",
                                      });
                                    }}
                                    disabled={isPending}
                                  >
                                    <X className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                                <audio controls src={field.value} className="w-full" />
                              </div>
                            ) : (
                              <AudioRecorder
                                onUploadComplete={(url) => {
                                  field.onChange(url);
                                  toast({
                                    title: "Nota de voz guardada",
                                    description: "La nota de voz se ha agregado a la tarea",
                                  });
                                }}
                                disabled={isPending}
                              />
                            )}
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-muted-foreground">
                            Graba una nota de voz con los detalles de la tarea
                          </p>
                        </FormItem>
                      );
                    }}
                  />
                </div>
              </div>

              <div className="sticky bottom-0 left-0 right-0 bg-background pt-4 border-t flex justify-end gap-4 z-10">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="min-w-[120px]"
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
              </div>
                  </form>
                </Form>
              </TabsContent>

          <TabsContent value="metrics" className="mt-6">
            {isLoadingMetrics ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Form {...metricsForm}>
                <form
                  onSubmit={metricsForm.handleSubmit(onMetricsSubmit)}
                  className="space-y-6"
                >
                  <Tabs defaultValue="meta" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="meta" className="flex items-center gap-2">
                        <span className="text-blue-600">Meta</span>
                        <span className="text-xs text-muted-foreground">(IG/FB)</span>
                      </TabsTrigger>
                      <TabsTrigger value="tiktok" className="flex items-center gap-2">
                        <span className="text-black dark:text-white">TikTok</span>
                      </TabsTrigger>
                      <TabsTrigger value="business" className="flex items-center gap-2">
                        <span className="text-green-600">Business Impact</span>
                      </TabsTrigger>
                    </TabsList>

                    {/* Tab Meta */}
                    <TabsContent value="meta" className="space-y-4 mt-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-blue-600">
                          Métricas Meta (Instagram/Facebook)
                        </h3>
                      </div>

                      <FormField
                        control={metricsForm.control}
                        name="metaViews"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vistas</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                value={field.value || ""}
                                disabled={isSavingMetrics}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Ve a 'Ver Estadísticas' en tu publicación y busca 'Vistas'.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={metricsForm.control}
                        name="metaLikes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Likes</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                value={field.value || ""}
                                disabled={isSavingMetrics}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Ve a 'Ver Estadísticas' y busca 'Me gusta'.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={metricsForm.control}
                        name="metaComments"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Comentarios</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                value={field.value || ""}
                                disabled={isSavingMetrics}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Ve a 'Ver Estadísticas' y busca 'Comentarios'.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={metricsForm.control}
                        name="metaShares"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Compartidos</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                value={field.value || ""}
                                disabled={isSavingMetrics}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Ve a 'Ver Estadísticas' y busca 'Compartidos'.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {task?.type === "REEL" && (
                        <FormField
                          control={metricsForm.control}
                          name="metaSaves"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Guardados</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  value={field.value || ""}
                                  disabled={isSavingMetrics}
                                />
                              </FormControl>
                              <p className="text-xs text-muted-foreground">
                                Ve a 'Ver Estadísticas' y busca 'Guardados'.
                              </p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={metricsForm.control}
                        name="metaReach"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Alcance</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                value={field.value || ""}
                                disabled={isSavingMetrics}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Ve a 'Ver Estadísticas' y busca 'Cuentas alcanzadas'.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>

                    {/* Tab TikTok */}
                    <TabsContent value="tiktok" className="space-y-4 mt-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">
                          Métricas TikTok
                        </h3>
                      </div>

                      <FormField
                        control={metricsForm.control}
                        name="ttViews"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vistas</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                value={field.value || ""}
                                disabled={isSavingMetrics}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Busca el número de vistas en las estadísticas del video.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={metricsForm.control}
                        name="ttLikes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Likes</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                value={field.value || ""}
                                disabled={isSavingMetrics}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Busca el número de likes en las estadísticas del video.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={metricsForm.control}
                        name="ttComments"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Comentarios</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                value={field.value || ""}
                                disabled={isSavingMetrics}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Busca el número de comentarios en las estadísticas del video.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={metricsForm.control}
                        name="ttShares"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Compartidos</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                value={field.value || ""}
                                disabled={isSavingMetrics}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Busca el número de compartidos en las estadísticas del video.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {task?.type === "REEL" && (
                        <FormField
                          control={metricsForm.control}
                          name="ttSaves"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Guardados</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  value={field.value || ""}
                                  disabled={isSavingMetrics}
                                />
                              </FormControl>
                              <p className="text-xs text-muted-foreground">
                                Busca el icono de la cinta en las estadísticas del video.
                              </p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </TabsContent>

                    {/* Tab Business Impact */}
                    <TabsContent value="business" className="space-y-4 mt-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-green-600">
                          Business Impact - Conversión y Ventas
                        </h3>
                      </div>

                      <FormField
                        control={metricsForm.control}
                        name="conversions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Conversiones / Leads</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                value={field.value || ""}
                                disabled={isSavingMetrics}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Número de personas que preguntaron o se interesaron (leads).
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={metricsForm.control}
                        name="salesCount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ventas Cerradas</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                value={field.value || ""}
                                disabled={isSavingMetrics}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Cuántos efectivamente compraron o cerraron venta.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={metricsForm.control}
                        name="revenue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ingresos (Revenue)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                value={field.value || ""}
                                disabled={isSavingMetrics}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Dinero total generado por esta pieza de contenido.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={metricsForm.control}
                        name="conversionSource"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Origen de Conversión</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || ""}
                              disabled={isSavingMetrics}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona el origen" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                                <SelectItem value="Web">Web</SelectItem>
                                <SelectItem value="DM">DM (Direct Message)</SelectItem>
                                <SelectItem value="Link en Bio">Link en Bio</SelectItem>
                                <SelectItem value="Local Físico">Local Físico</SelectItem>
                                <SelectItem value="Otro">Otro</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              ¿De dónde provinieron las conversiones?
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                  </Tabs>

                  {/* Campos globales */}
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Información Adicional</h3>
                    
                    <FormField
                      control={metricsForm.control}
                      name="totalBudgetSpent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Presupuesto Gastado (opcional)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                              value={field.value ?? ""}
                              disabled={isSavingMetrics}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={metricsForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notas (opcional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Notas adicionales sobre estas métricas..."
                              {...field}
                              value={field.value || ""}
                              disabled={isSavingMetrics}
                              className="min-h-[80px]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="submit"
                      disabled={isSavingMetrics}
                      className="flex-1"
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

            {/* Análisis de Valor */}
            {task && displayMetrics && (
              <div className="mt-8 border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Análisis de Valor</h3>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Métricas calculadas por Totem OS para evaluar el rendimiento de tu contenido
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card de ER Meta */}
                  {((displayMetrics as any)?.metaReach > 0 || (displayMetrics as any)?.metaViews > 0) && (
                    <Card className="border-l-4 border-l-blue-600">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                          ER Meta
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-3xl font-bold text-blue-600">
                            {((displayMetrics as any)?.erMeta || 0).toFixed(2)}%
                          </p>
                          <CardDescription className="text-sm text-muted-foreground">
                            Engagement Rate Meta (IG/FB)
                          </CardDescription>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Card de ER TikTok */}
                  {((displayMetrics as any)?.ttViews > 0) && (
                    <Card className="border-l-4 border-l-black dark:border-l-white">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          ER TikTok
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-3xl font-bold">
                            {((displayMetrics as any)?.erTikTok || 0).toFixed(2)}%
                          </p>
                          <CardDescription className="text-sm text-muted-foreground">
                            Engagement Rate TikTok
                          </CardDescription>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Card de Lealtad de Marca */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        Lealtad de Marca
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-3xl font-bold">
                          {calculateBrandLoyalty(displayMetrics).toFixed(2)}%
                        </p>
                        <CardDescription className="text-sm text-muted-foreground">
                          Su marca no solo se ve, se recomienda y se guarda
                        </CardDescription>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card de Eficiencia de Inversión */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Eficiencia de Inversión
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {(() => {
                          const efficiency = calculateInvestmentEfficiency(
                            displayMetrics,
                            task.client.monthlyRate || 0
                          );
                          return (
                            <>
                              <p className="text-3xl font-bold">
                                {formatCurrency(efficiency)}
                              </p>
                              <CardDescription className="text-sm text-muted-foreground">
                                Cada interacción con un cliente potencial le costó{" "}
                                {formatCurrency(efficiency)}
                              </CardDescription>
                            </>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
          ) : (
            <>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="flex flex-col h-full relative"
                >
                  <div className="flex-1 overflow-y-auto py-4 px-1 space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Título de la tarea"
                            {...field}
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Campo de Cliente solo para nuevas tareas */}
                  {isNewTask && clients.length > 0 && (
                    <FormField
                      control={form.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cliente</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            disabled={isPending}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un cliente" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clients.map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="flex flex-col sm:flex-row gap-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Tipo de Contenido</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
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
                      name="assignedToId"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Asignar a</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                          value={field.value || "none"}
                          disabled={isPending}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un usuario (opcional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Sin asignar</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name}
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
                      <FormItem>
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

                  </div>

                  <div className="sticky bottom-0 left-0 right-0 bg-background pt-4 border-t flex justify-end gap-4 z-10">
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="min-w-[120px]"
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
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={isPending}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </Form>
            </>
          )}

          {/* Recursos del Cliente - Solo para tareas existentes */}
          {task && task.client.brandAssets && task.client.brandAssets.length > 0 && (
            <div className="mt-8 border-t pt-6">
              <h3 className="text-sm font-semibold mb-4">Recursos del Cliente</h3>
              <div className="grid grid-cols-1 gap-3">
                {task.client.brandAssets.map((asset) => {
                  const getFileIcon = () => {
                    switch (asset.fileType) {
                      case "image":
                        return <Image className="h-4 w-4" />;
                      case "pdf":
                        return <FileText className="h-4 w-4" />;
                      default:
                        return <FileText className="h-4 w-4" />;
                    }
                  };

                  const getFileCategory = (fileName: string): "Logo" | "Paleta" | "Documento" => {
                    const lowerName = fileName.toLowerCase();
                    if (lowerName.includes("logo") || lowerName.includes("brand")) {
                      return "Logo";
                    }
                    if (lowerName.includes("color") || lowerName.includes("palette") || lowerName.includes("paleta")) {
                      return "Paleta";
                    }
                    return "Documento";
                  };

                  const category = getFileCategory(asset.name);
                  const isCopied = copiedUrl === asset.url;

                  return (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          {getFileIcon()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{asset.name}</p>
                          <Badge variant="secondary" className="text-xs mt-1">
                            {category === "Logo" && <Palette className="h-3 w-3 mr-1" />}
                            {category}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(asset.url);
                              setCopiedUrl(asset.url);
                              toast({
                                title: "URL copiada",
                                description: "La URL del archivo ha sido copiada al portapapeles.",
                              });
                              setTimeout(() => setCopiedUrl(null), 2000);
                            } catch (error) {
                              toast({
                                variant: "destructive",
                                title: "Error al copiar URL",
                                description: "No se pudo copiar la URL al portapapeles.",
                              });
                            }
                          }}
                          className="h-8 w-8 p-0"
                        >
                          {isCopied ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(asset.url, "_blank")}
                          className="h-8 w-8 p-0"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Botón de eliminar - Solo para tareas existentes */}
          {!isNewTask && (
            <div className="mt-8 border-t pt-6">
              <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full"
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
                      Esta acción no se puede deshacer. La tarea será eliminada
                      permanentemente.
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
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

