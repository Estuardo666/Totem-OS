"use client";

import { useState, useEffect, useTransition } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { subHours } from "date-fns";
import { Loader2, Trash2 } from "lucide-react";
import { updateContentTaskSchema, createContentTaskSchema, type UpdateContentTaskInput, type CreateContentTaskInput } from "@/schemas/content";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import { updateTask, deleteTask, createTask } from "@/actions/content-actions";
import type { User } from "@prisma/client";
import type { UserWithTaskCount } from "@/actions/user.actions";
import type { ContentTaskStatus, ContentTaskType } from "@/types";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { TooltipProvider } from "@/components/ui/tooltip";
import { TaskReviewTab } from "@/components/features/content/task-review-tab";

const CONTENT_TASK_TYPES: readonly ContentTaskType[] = ["REEL", "FLYER", "STORY"];
const CONTENT_TASK_STATUSES: readonly ContentTaskStatus[] = [
  "IDEA",
  "SCRIPT",
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateInputValue = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

const buildTaskFormValues = (
  currentTask: ContentTaskWithClient | null,
  initialScheduledAt?: Date | string,
  initialDefaults?: Partial<CreateTaskFormValues>
): TaskFormValues => {
  const scheduledValue = currentTask
    ? formatDateForInput(currentTask.scheduledAt)
    : formatDateForInput(initialScheduledAt);

  return {
    title: initialDefaults?.title ?? currentTask?.title ?? "",
    type: currentTask ? ensureTaskType(currentTask.type) : ensureTaskType(initialDefaults?.type),
    status: currentTask ? ensureTaskStatus(currentTask.status) : ensureTaskStatus(initialDefaults?.status),
    priority: ensureTaskPriority((currentTask as any)?.priority ?? initialDefaults?.priority),
    clientId: currentTask?.clientId ?? initialDefaults?.clientId ?? "",
    assignedEditorId: currentTask?.assignedEditorId ?? initialDefaults?.assignedEditorId ?? undefined,
    assignedCommunityId: currentTask?.assignedCommunityId ?? initialDefaults?.assignedCommunityId ?? undefined,
    dueDate: formatDateForInput(currentTask?.dueDate ?? (initialDefaults as any)?.dueDate) ?? undefined,
    scheduledAt:
      scheduledValue ??
      formatDateForInput((initialDefaults as any)?.scheduledAt) ??
      (!currentTask ? formatDateForInput(new Date()) : undefined),
    postCopy: currentTask?.postCopy ?? initialDefaults?.postCopy ?? undefined,
    coverImageUrl: currentTask?.coverImageUrl ?? initialDefaults?.coverImageUrl ?? undefined,
    audioBriefUrl: currentTask?.audioBriefUrl ?? initialDefaults?.audioBriefUrl ?? undefined,
    scriptUrl: currentTask?.scriptUrl ?? initialDefaults?.scriptUrl ?? undefined,
    shootId: undefined,
    reviewToken: undefined,
    clientFeedback: currentTask?.clientFeedback ?? initialDefaults?.clientFeedback ?? undefined,
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
    defaultValues: buildTaskFormValues(task, initialScheduledAt, initialDefaults),
  });

  const selectedClientId = form.watch("clientId");
  const feedbackValue = form.watch("clientFeedback");
  const selectedClient = filteredClients.find((c) => c.id === selectedClientId) || clients.find((c) => c.id === selectedClientId) || task?.client;

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

  // Si es una nueva tarea y no hay initialScheduledAt, no mostrar el sheet
  if (!task && !initialScheduledAt && !open) return null;

  // Función helper para obtener las iniciales de un usuario
  const getUserInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex min-h-0 max-h-[92vh] w-[95vw] max-w-3xl flex-col gap-3 overflow-hidden p-4 sm:w-[84vw] sm:p-5 md:w-[68vw] lg:w-[56vw] xl:w-[48vw]">
          <DialogHeader className="space-y-0.5 px-0 pb-2 pt-0 text-left sm:pb-3">
            <DialogTitle className="text-xl font-semibold leading-tight sm:text-2xl md:text-[28px]">
              {isNewTask ? "Nueva Tarea" : "Editar Tarea"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground sm:text-[15px]">
              {isNewTask ? "Crea una nueva tarea de contenido." : "Modifica los detalles de la tarea de contenido."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-0 pb-3 pr-1 transition-[height,max-height] duration-500 ease-smooth will-change-[height] max-h-[calc(92vh-148px)] sm:pr-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
              <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid h-10 w-full grid-cols-2 items-center rounded-full bg-muted px-1.5 py-1 text-muted-foreground sm:h-11 sm:px-2">
              <TabsTrigger value="details" className="rounded-full text-xs sm:text-sm">Detalles</TabsTrigger>
              <TabsTrigger value="review" className="rounded-full text-xs sm:text-sm">Revisión</TabsTrigger>
            </TabsList>

            {/* Tab Detalles */}
            <TabsContent value="details" className="mt-3 space-y-5 sm:mt-4 sm:space-y-6">
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
                          className="text-xl md:text-2xl font-semibold border border-input rounded-xl px-4 py-3 md:py-4 bg-white dark:bg-background focus:border-primary transition-all"
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
                            type="date"
                            value={typeof field.value === "string" ? field.value : formatDateForInput(field.value) || ""}
                            onChange={(e) => {
                              field.onChange(e.target.value || undefined);
                              // Calcular automáticamente la fecha de entrega cuando cambia la fecha programada
                              if (e.target.value) {
                                const scheduledDate = parseDateInputValue(e.target.value);
                                const calculatedDueDate = subHours(scheduledDate, 24);
                                form.setValue("dueDate", formatDateForInput(calculatedDueDate));
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
                          Selecciona el dia de publicacion. La hora no es obligatoria.
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
                          <SelectItem value="SCRIPT" className="rounded-lg">📝 Guión</SelectItem>
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

            <TabsContent value="review" className="mt-3 sm:mt-4">
              <TaskReviewTab
                task={task}
                disabled={isPending}
                feedbackValue={feedbackValue || undefined}
                onFeedbackChange={(value) => form.setValue("clientFeedback", value, { shouldDirty: true, shouldTouch: true })}
              />
            </TabsContent>
          </Tabs>

              {/* Botones finales */}
              <div className="mt-5 flex flex-col gap-2 border-t pt-4 sm:mt-6 sm:gap-3 sm:pt-5">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="h-10 w-full rounded-full sm:h-11"
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
