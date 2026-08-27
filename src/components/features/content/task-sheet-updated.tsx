"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { subHours } from "date-fns";
import { Loader2, Trash2, Copy, Check, Image as ImageIconLucide, FileText, Palette, ExternalLink } from "lucide-react";
import { updateContentTaskSchema, createContentTaskSchema, type UpdateContentTaskInput, type CreateContentTaskInput } from "@/schemas/content";
import type { z } from "zod";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import { updateTask, deleteTask, createTask } from "@/actions/content-actions";
import type { User } from "@prisma/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

interface TaskSheetProps {
  task: ContentTaskWithClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  clients?: Array<{ id: string; name: string; logo?: string | null; color?: string | null }>;
  initialScheduledAt?: Date | string;
}

/**
 * Convierte una fecha UTC a formato YYYY-MM-DDTHH:mm para datetime-local input
 * ✨ Esto asegura que la fecha se muestre correctamente en la hora local del navegador
 */
const formatToDatetimeLocal = (date: Date | string | undefined): string => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  
  // Usar getters locales (no UTC) para que el input muestre la hora correcta
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export function TaskSheet({ task, open, onOpenChange, users, clients = [], initialScheduledAt }: TaskSheetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const isNewTask = !task;
  
  type TaskSheetFormValues =
    | z.input<typeof updateContentTaskSchema>
    | z.input<typeof createContentTaskSchema>;

  const form = useForm<TaskSheetFormValues>({
    resolver: zodResolver(isNewTask ? createContentTaskSchema : updateContentTaskSchema),
    defaultValues: {
      title: task?.title || "",
      type: (task?.type as TaskSheetFormValues["type"]) || "REEL",
      status: (task?.status as TaskSheetFormValues["status"]) || "IDEA",
      clientId: task?.clientId || "",
      assignedEditorId: task?.assignedEditorId || undefined,
      dueDate: task?.dueDate
        ? new Date(task.dueDate).toISOString().split("T")[0]
        : undefined,
      scheduledAt: task?.scheduledAt
        ? formatToDatetimeLocal(task.scheduledAt)
        : undefined,
    },
  });

  // Resetear el formulario cuando cambia la tarea o se abre para crear nueva
  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        type: task.type as TaskSheetFormValues["type"],
        status: task.status as TaskSheetFormValues["status"],
        clientId: task.clientId,
        assignedEditorId: task.assignedEditorId || undefined,
        dueDate: task.dueDate
          ? new Date(task.dueDate).toISOString().split("T")[0]
          : undefined,
        scheduledAt: task.scheduledAt
          ? formatToDatetimeLocal(task.scheduledAt)
          : undefined,
      });
    } else {
      // Resetear para nueva tarea
      const scheduledAtValue = initialScheduledAt
        ? formatToDatetimeLocal(initialScheduledAt)
        : undefined;
      
      form.reset({
        title: "",
        type: "REEL",
        status: "IDEA",
        clientId: "",
        assignedEditorId: undefined,
        dueDate: undefined,
        scheduledAt: scheduledAtValue,
      });
    }
  }, [task, form, initialScheduledAt]);

  const onSubmit = async (data: TaskSheetFormValues) => {
    setIsSubmitting(true);

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
    } finally {
      setIsSubmitting(false);
    }
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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isNewTask ? "Nueva Tarea" : "Editar Tarea"}</SheetTitle>
            <SheetDescription>
              {isNewTask 
                ? "Crea una nueva tarea de contenido." 
                : "Modifica los detalles de la tarea de contenido."}
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="mt-6 space-y-6"
            >
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
                        disabled={isSubmitting}
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
                        disabled={isSubmitting}
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

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Contenido</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isSubmitting}
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
                name="assignedEditorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asignar a</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                      value={field.value || "none"}
                      disabled={isSubmitting}
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

              <FormField
                control={form.control}
                name="scheduledAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={task?.status === "CLIENT_APPROVED" ? "text-orange-600 font-semibold" : ""}>
                      Fecha de Entrega Interna
                      {task?.status === "CLIENT_APPROVED" && (
                        <span className="ml-2 text-xs text-orange-600">⚠️ No olvides programarla</span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        value={formatToDatetimeLocal(field.value)}
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
                        disabled={isSubmitting}
                        className={task?.status === "CLIENT_APPROVED" ? "border-orange-300 focus:border-orange-500 focus:ring-orange-500" : ""}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Fecha cuando debe estar lista la tarea para publicar
                    </p>
                  </FormItem>
                )}
              />

              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? (
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
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </Form>

          {/* Recursos del Cliente - Solo para tareas existentes */}
          {task && task.client.brandAssets && task.client.brandAssets.length > 0 && (
            <div className="mt-8 border-t pt-6">
              <h3 className="text-sm font-semibold mb-4">Recursos del Cliente</h3>
              <div className="grid grid-cols-1 gap-3">
                {task.client.brandAssets.map((asset) => {
                  const getFileIcon = () => {
                    switch (asset.fileType) {
                      case "image":
                        return <ImageIconLucide className="h-4 w-4" />;
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
                    disabled={isDeleting || isSubmitting}
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

