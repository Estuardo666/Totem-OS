"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, isToday, differenceInHours } from "date-fns";
import Pusher from "pusher-js";
import { Video, Image as ImageIconLucide, Camera, ImageIcon, CheckCircle2, Sparkles } from "lucide-react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import { updateTaskStatus, getTasks } from "@/actions/content-actions";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TaskSheet } from "./task-sheet";
import type { ContentTaskStatus } from "@/types";
import type { User } from "@prisma/client";

interface KanbanBoardProps {
  tasks: ContentTaskWithClient[];
  users: User[];
  clients?: Array<{ id: string; name: string }>;
}

// Estados que se mostrarán en el Kanban
const KANBAN_COLUMNS: {
  status: ContentTaskStatus;
  label: string;
}[] = [
  { status: "IDEA", label: "Idea" },
  { status: "RECORDED", label: "Grabado" },
  { status: "EDITING", label: "Editando" },
  { status: "REVIEW_CLIENT", label: "Revisión Cliente" },
  { status: "CLIENT_APPROVED", label: "Aprobado por Cliente" },
  { status: "PUBLISHED", label: "Publicado" },
];

// Función para obtener el icono según el tipo
function getTypeIcon(type: string) {
  switch (type) {
    case "REEL":
      return <Video className="h-4 w-4" />;
    case "STORY":
      return <Camera className="h-4 w-4" />;
    case "FLYER":
      return <ImageIconLucide className="h-4 w-4" />;
    default:
      return null;
  }
}

// Función para obtener el label del tipo
function getTypeLabel(type: string) {
  switch (type) {
    case "REEL":
      return "Reel";
    case "STORY":
      return "Story";
    case "FLYER":
      return "Flyer";
    default:
      return type;
  }
}

// Componente de tarjeta individual
function TaskCard({
  task,
  index,
  onCardClick,
}: {
  task: ContentTaskWithClient;
  index: number;
  onCardClick: (task: ContentTaskWithClient) => void;
}) {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`mb-3 cursor-grab active:cursor-grabbing transition-all border-l-4 ${
            snapshot.isDragging
              ? "shadow-lg ring-2 ring-primary"
              : "hover:shadow-md"
          } ${
            task.status === "REVIEW_CLIENT" || task.status === "APPROVED" || task.status === "CLIENT_APPROVED"
              ? "border-l-4 border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-200 dark:ring-emerald-800"
              : ""
          }`}
          style={{
            ...provided.draggableProps.style,
            borderLeftColor:
              task.status === "REVIEW_CLIENT" || task.status === "APPROVED" || task.status === "CLIENT_APPROVED"
                ? undefined
                : task.client.color || "#000000",
          }}
          onClick={(e) => {
            // Solo abrir el sheet si no estamos arrastrando
            // Si el usuario hizo drag, snapshot.isDragging será true
            if (!snapshot.isDragging) {
              e.stopPropagation();
              onCardClick(task);
            }
          }}
        >
          <CardContent
            className={task.status === "PUBLISHED" ? "p-2" : "p-4"}
          >
            {task.status === "PUBLISHED" ? (
              // Modo compacto para tareas publicadas
              <div className="space-y-1">
                <h4 className="font-semibold text-sm leading-tight">
                  {task.title}
                </h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{task.client.name}</span>
                  {task.client.brandAssets && task.client.brandAssets.length > 0 && (
                    <div
                      className="flex items-center"
                      title={`${task.client.brandAssets.length} recursos de marca disponibles`}
                    >
                      <ImageIcon className="h-3 w-3 text-primary" />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Modo normal para otras tareas
              <div className="space-y-2">
                {/* Título */}
                <h4 className="font-semibold text-sm leading-tight">
                  {task.title}
                </h4>

                {/* Cliente */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {task.client.name}
                  </Badge>
                  {/* Badge "Nuevo" si la tarea fue asignada en las últimas 24 horas */}
                  {task.assignedAt && differenceInHours(new Date(), new Date(task.assignedAt)) < 24 && (
                    <Badge
                      variant="default"
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
                    >
                      <Sparkles className="h-3 w-3" />
                      Nuevo
                    </Badge>
                  )}
                  {(task.status === "REVIEW_CLIENT" || task.status === "APPROVED" || task.status === "CLIENT_APPROVED") && (
                    <Badge
                      variant="default"
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                    >
                      {task.status === "CLIENT_APPROVED" && (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      {task.status === "REVIEW_CLIENT" 
                        ? "En Revisión" 
                        : task.status === "CLIENT_APPROVED"
                        ? "Aprobado por Cliente"
                        : "Aprobado"}
                    </Badge>
                  )}
                  {task.client.brandAssets && task.client.brandAssets.length > 0 && (
                    <div
                      className="flex items-center"
                      title={`${task.client.brandAssets.length} recursos de marca disponibles`}
                    >
                      <ImageIcon className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                </div>

                {/* Tipo e Icono */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {getTypeIcon(task.type)}
                  <span>{getTypeLabel(task.type)}</span>
                </div>

                {/* Fecha de entrega */}
                {task.dueDate && (
                  <div className="text-xs text-muted-foreground">
                    Entrega: {format(new Date(task.dueDate), "dd/MM/yyyy")}
                  </div>
                )}

                {/* Fecha programada */}
                {task.scheduledAt && (
                  <div className={`text-xs flex items-center gap-1 ${
                    isToday(new Date(task.scheduledAt))
                      ? "text-orange-600 font-semibold"
                      : "text-muted-foreground"
                  }`}>
                    <span>📅</span>
                    <span>
                      {format(new Date(task.scheduledAt), "dd MMM, HH:mm")}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </Draggable>
  );
}

export function KanbanBoard({ tasks: initialTasks, users, clients = [] }: KanbanBoardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<ContentTaskWithClient[]>(initialTasks);
  const [isMounted, setIsMounted] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ContentTaskWithClient | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Manejo de hidratación: solo renderizar DragDropContext después del mount
  useEffect(() => {
    setIsMounted(true);
    
    // 🔑 Depuración de Variables de Entorno (solo una vez al montar)
    console.log("🔑 Clave Pusher Frontend:", process.env.NEXT_PUBLIC_PUSHER_KEY);
    console.log("🔑 Cluster Pusher Frontend:", process.env.NEXT_PUBLIC_PUSHER_CLUSTER);
  }, []);

  // Sincronizar tasks cuando initialTasks cambie (después de revalidación)
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  // Configurar Pusher para actualizaciones en tiempo real
  useEffect(() => {
    // Solo inicializar Pusher en el cliente
    if (typeof window === "undefined") return;

    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY as string | undefined;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER as string | undefined;

    if (!pusherKey || !pusherCluster) {
      console.warn("⚠️ Pusher no está configurado. Las actualizaciones en tiempo real no estarán disponibles.");
      toast({
        variant: "destructive",
        title: "Configuración faltante",
        description: "Falta configuración de tiempo real. Por favor, verifica las variables de entorno.",
      });
      return;
    }

    console.log("🔌 Inicializando conexión Pusher...");

    // Inicializar Pusher
    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
    });

    // Logs de estado de conexión de Pusher
    pusher.connection.bind("connected", () => {
      console.log("✅ Pusher conectado exitosamente");
    });

    pusher.connection.bind("disconnected", () => {
      console.log("⚠️ Pusher desconectado");
    });

    pusher.connection.bind("error", (error: unknown) => {
      console.error("❌ Error de conexión Pusher:", error);
    });

    pusher.connection.bind("state_change", (states: { previous: string; current: string }) => {
      console.log(`🔄 Estado Pusher: ${states.previous} → ${states.current}`);
    });

    // Suscribirse al canal
    const channel = pusher.subscribe("kanban-channel");
    
    // Verificar suscripción
    channel.bind("pusher:subscription_succeeded", () => {
      console.log("✅ Suscrito al canal kanban-channel");
      console.log("👂 Esperando eventos 'update-event'...");
    });

    channel.bind("pusher:subscription_error", (error: unknown) => {
      console.error("❌ Error al suscribirse al canal:", error);
    });

    // Debug: Escuchar TODOS los eventos para ver qué está pasando
    channel.bind_global((eventName: string, data: unknown) => {
      console.log(`🔍 Evento global recibido en canal kanban-channel:`, eventName, data);
    });

    // Escuchar el evento de actualización
    const handleUpdateEvent = async (data: unknown) => {
      console.log("📨📨📨 Evento 'update-event' recibido de Pusher:", data);
      console.log("📨 Tipo de datos:", typeof data);
      console.log("📨 Datos completos:", JSON.stringify(data, null, 2));
      
      // Recargar tareas directamente desde el servidor
      try {
        console.log("🔄 Recargando tareas desde getTasks()...");
        const result = await getTasks();
        if (result.success && result.data) {
          console.log("✅ Tareas actualizadas exitosamente:", result.data.length);
          // Actualizar el estado directamente (más rápido que router.refresh)
          setTasks(result.data);
          
          // Mostrar toast de confirmación
          toast({
            title: "Actualizado",
            description: "El tablero se ha sincronizado con los últimos cambios",
            duration: 2000,
          });
        } else {
          console.error("❌ Error al obtener tareas:", result.error);
          // No usar router.refresh() como fallback, mejor mostrar error
          toast({
            variant: "destructive",
            title: "Error al sincronizar",
            description: result.error || "No se pudieron cargar las tareas actualizadas",
          });
        }
      } catch (error) {
        console.error("❌ Error en handleUpdateEvent:", error);
        toast({
          variant: "destructive",
          title: "Error de sincronización",
          description: error instanceof Error ? error.message : "Error desconocido al sincronizar",
        });
      }
    };

    console.log("🔗 Vinculando handler para 'update-event'...");
    channel.bind("update-event", handleUpdateEvent);
    console.log("✅ Handler vinculado. Esperando eventos...");

    // Limpiar al desmontar - solo unsubscribe del canal
    return () => {
      console.log("🧹 Limpiando suscripción de Pusher...");
      channel.unbind("update-event", handleUpdateEvent);
      channel.unsubscribe();
      // NO desconectar pusher completamente para mantener la conexión estable
    };
  }, [toast]); // Agregar toast como dependencia

  // Función para reorganizar las tareas localmente
  const reorderTasks = (
    sourceStatus: ContentTaskStatus,
    destinationStatus: ContentTaskStatus,
    sourceIndex: number,
    destinationIndex: number
  ): ContentTaskWithClient[] => {
    const newTasks = [...tasks];
    const sourceTasks = newTasks.filter((task) => task.status === sourceStatus);
    const destinationTasks = newTasks.filter(
      (task) => task.status === destinationStatus
    );

    // Si es la misma columna, solo reordenar
    if (sourceStatus === destinationStatus) {
      const [removed] = sourceTasks.splice(sourceIndex, 1);
      sourceTasks.splice(destinationIndex, 0, removed);
      return newTasks.map((task) => {
        if (task.status === sourceStatus) {
          const newIndex = sourceTasks.findIndex((t) => t.id === task.id);
          if (newIndex !== -1) {
            return sourceTasks[newIndex];
          }
        }
        return task;
      });
    }

    // Si es diferente columna, mover y cambiar status
    const [removed] = sourceTasks.splice(sourceIndex, 1);
    const updatedTask = {
      ...removed,
      status: destinationStatus,
    };
    destinationTasks.splice(destinationIndex, 0, updatedTask);

    return newTasks.map((task) => {
      if (task.id === removed.id) {
        return updatedTask;
      }
      return task;
    });
  };

  // Manejar el final del drag
  const onDragEnd = async (result: DropResult) => {
    const { destination, source } = result;

    // Si no hay destino, cancelar
    if (!destination) {
      return;
    }

    // Si no cambió de posición, no hacer nada
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceStatus = source.droppableId as ContentTaskStatus;
    const destinationStatus = destination.droppableId as ContentTaskStatus;

    // Encontrar la tarea que se está moviendo
    const taskToMove = tasks.find(
      (task) => task.id === result.draggableId && task.status === sourceStatus
    );

    if (!taskToMove) {
      return;
    }

    // Guardar el estado anterior para posible reversión
    const previousTasks = [...tasks];

    // ACTUALIZACIÓN OPTIMISTA: Actualizar el estado local inmediatamente
    const optimisticTasks = reorderTasks(
      sourceStatus,
      destinationStatus,
      source.index,
      destination.index
    );
    setTasks(optimisticTasks);

    // Si cambió de columna (status), actualizar en la base de datos
    if (sourceStatus !== destinationStatus) {
      try {
        const result = await updateTaskStatus(taskToMove.id, destinationStatus);

        if (!result.success) {
          // Revertir el cambio si falla
          setTasks(previousTasks);
          toast({
            variant: "destructive",
            title: "Error al actualizar tarea",
            description: result.error || "No se pudo actualizar el estado",
          });
        } else {
          // Disparar evento personalizado para notificar que se actualizó el estado
          // Esto permite que otros componentes (como ContractFulfillment) se actualicen
          window.dispatchEvent(new CustomEvent("taskStatusUpdated", {
            detail: {
              taskId: taskToMove.id,
              oldStatus: sourceStatus,
              newStatus: destinationStatus,
            },
          }));
          // No refrescar automáticamente - Pusher debería notificar a todos los clientes
          // El evento de Pusher se enviará desde el servidor y actualizará a todos los usuarios
          console.log("✅ Tarea actualizada. Pusher notificará a otros usuarios automáticamente.");
        }
      } catch (error) {
        // Revertir el cambio si hay excepción
        setTasks(previousTasks);
        toast({
          variant: "destructive",
          title: "Error al actualizar tarea",
          description:
            error instanceof Error
              ? error.message
              : "Ocurrió un error inesperado",
        });
      }
    }
  };

  // Filtrar tareas por estado
  const tasksByStatus = KANBAN_COLUMNS.reduce(
    (acc, column) => {
      acc[column.status] = tasks.filter((task) => task.status === column.status);
      return acc;
    },
    {} as Record<ContentTaskStatus, ContentTaskWithClient[]>
  );

  // Si no está montado, mostrar versión estática (sin drag & drop)
  if (!isMounted) {
    return (
      <div className="w-full overflow-x-auto pb-4">
        <div className="grid min-w-[960px] grid-cols-1 gap-3 md:grid-cols-6">
          {KANBAN_COLUMNS.map((column) => {
            const columnTasks = tasksByStatus[column.status] || [];

            return (
              <div key={column.status} className="flex flex-col min-w-0">
                <div className="mb-3 flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-2">
                  <h3 className="font-semibold text-sm truncate">{column.label}</h3>
                  <Badge variant="secondary" className="ml-2 flex-shrink-0">
                    {columnTasks.length}
                  </Badge>
                </div>
                <div className="flex-1 space-y-2">
                  {columnTasks.length > 0 ? (
                    columnTasks.map((task) => (
                      <Card
                        key={task.id}
                        className={`mb-3 border-l-4 ${
                          task.status === "REVIEW_CLIENT" || task.status === "APPROVED" || task.status === "CLIENT_APPROVED"
                            ? "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-200 dark:ring-emerald-800"
                            : ""
                        }`}
                        style={{
                          borderLeftColor:
                            task.status === "REVIEW_CLIENT" || task.status === "APPROVED" || task.status === "CLIENT_APPROVED"
                              ? undefined
                              : task.client.color || "#000000",
                        }}
                      >
                        <CardContent
                          className={task.status === "PUBLISHED" ? "p-2" : "p-4"}
                        >
                          {task.status === "PUBLISHED" ? (
                            // Modo compacto para tareas publicadas
                            <div className="space-y-1">
                              <h4 className="font-semibold text-sm leading-tight">
                                {task.title}
                              </h4>
                              <div className="text-xs text-muted-foreground">
                                {task.client.name}
                              </div>
                            </div>
                          ) : (
                            // Modo normal para otras tareas
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm leading-tight">
                                {task.title}
                              </h4>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-xs">
                                  {task.client.name}
                                </Badge>
                                {(task.status === "REVIEW_CLIENT" || task.status === "APPROVED" || task.status === "CLIENT_APPROVED") && (
                                  <Badge
                                    variant="default"
                                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                                  >
                                    {task.status === "CLIENT_APPROVED" && (
                                      <CheckCircle2 className="h-3 w-3" />
                                    )}
                                    {task.status === "REVIEW_CLIENT" 
                                      ? "En Revisión" 
                                      : task.status === "CLIENT_APPROVED"
                                      ? "Aprobado por Cliente"
                                      : "Aprobado"}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {getTypeIcon(task.type)}
                                <span>{getTypeLabel(task.type)}</span>
                              </div>
                              {task.dueDate && (
                                <div className="text-xs text-muted-foreground">
                                  Entrega: {format(new Date(task.dueDate), "dd/MM/yyyy")}
                                </div>
                              )}
                              {task.scheduledAt && (
                                <div className={`text-xs flex items-center gap-1 ${
                                  isToday(new Date(task.scheduledAt))
                                    ? "text-orange-600 font-semibold"
                                    : "text-muted-foreground"
                                }`}>
                                  <span>📅</span>
                                  <span>
                                    {format(new Date(task.scheduledAt), "dd MMM, HH:mm")}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                      Sin tareas
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Versión con drag & drop
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="w-full overflow-x-auto pb-4">
        <div className="grid min-w-[960px] grid-cols-1 gap-3 md:grid-cols-6">
          {KANBAN_COLUMNS.map((column) => {
            const columnTasks = tasksByStatus[column.status] || [];

            return (
              <div key={column.status} className="flex flex-col min-w-0">
                {/* Header de la columna */}
                <div className="mb-3 flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-2">
                  <h3 className="font-semibold text-sm truncate">{column.label}</h3>
                  <Badge variant="secondary" className="ml-2 flex-shrink-0">
                    {columnTasks.length}
                  </Badge>
                </div>

                {/* Área droppable */}
                <Droppable droppableId={column.status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 min-h-[200px] rounded-md transition-colors overflow-hidden ${
                        snapshot.isDraggingOver
                          ? "bg-primary/5 border-2 border-dashed border-primary"
                          : ""
                      }`}
                    >
                      <div className="space-y-2">
                        {columnTasks.length > 0 ? (
                          columnTasks.map((task, index) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              index={index}
                              onCardClick={(task) => {
                                setSelectedTask(task);
                                setIsSheetOpen(true);
                              }}
                            />
                          ))
                        ) : (
                          <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                            Sin tareas
                          </div>
                        )}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sheet de edición */}
      <TaskSheet
        task={selectedTask}
        open={isSheetOpen}
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) {
            setSelectedTask(null);
          }
        }}
        users={users}
        clients={clients}
      />
    </DragDropContext>
  );
}
