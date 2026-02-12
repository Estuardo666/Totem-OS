"use client";

import { useState, useEffect, useOptimistic, useRef, startTransition } from "react";

import Pusher from "pusher-js";
import { CheckCircle2 } from "lucide-react";
import {
  DragDropContext,
  DropResult,
  DragUpdate,
} from "@hello-pangea/dnd";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import { updateTaskStatus, getTasks } from "@/actions/content-actions";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ContentTaskStatus } from "@/types";
import type { User } from "@prisma/client";
import { KanbanColumn } from "./KanbanColumn";
import { TaskSheet } from "./task-sheet";

interface KanbanBoardProps {
  tasks: ContentTaskWithClient[];
  users: User[];
  clients?: Array<{ id: string; name: string }>;
  isCompactView?: boolean;
  clientId?: string; // Si se proporciona, filtra las tareas solo para este cliente
}

// Estados que se mostrarán en el Kanban
const KANBAN_COLUMNS: {
  status: ContentTaskStatus;
  label: string;
}[] = [
  { status: "IDEA", label: "Guión" },
  { status: "RECORDED", label: "Grabado" },
  { status: "EDITING", label: "Editando" },
  { status: "REVIEW_CLIENT", label: "Revisión Cliente" },
  { status: "CLIENT_APPROVED", label: "Aprobado por Cliente" },
  { status: "PUBLISHED", label: "Publicado" },
];

export function KanbanBoard({ tasks: initialTasks, users, clients = [], isCompactView = false, clientId }: KanbanBoardProps) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<ContentTaskWithClient[]>(initialTasks);
  const [isMounted, setIsMounted] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ContentTaskWithClient | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollFrame = useRef<number | null>(null);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverColumn, setHoverColumn] = useState<ContentTaskStatus | null>(null);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  // useOptimistic para actualizaciones instantáneas
  const [optimisticTasks, setOptimisticTasks] = useOptimistic(
    tasks,
    (state, { taskId, newStatus }: { taskId: string; newStatus: ContentTaskStatus }) => {
      return state.map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task
      );
    }
  );

  // Montar el componente solo en el cliente
  useEffect(() => {
    setIsMounted(true);
    console.log("🔑 Cluster Pusher Frontend:", process.env.NEXT_PUBLIC_PUSHER_CLUSTER);
  }, []);

  // Auto-scroll horizontal en mobile mientras se arrastra
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const container = scrollRef.current;
      if (!container) return;

      const prev = lastPointer.current;
      lastPointer.current = { x: e.clientX, y: e.clientY };

      const rect = container.getBoundingClientRect();
      const edge = 180; // px desde el borde para disparar scroll

      const deltaLeft = e.clientX - rect.left;
      const deltaRight = rect.right - e.clientX;

      // Detectar dirección real del dedo para evitar scroll inicial al lado opuesto
      const movementX = prev ? e.clientX - prev.x : 0;

      let direction: -1 | 0 | 1 = 0;
      let intensity = 0;
      if (deltaLeft < edge && movementX < 0) {
        direction = -1;
        intensity = (edge - deltaLeft) / edge;
      } else if (deltaRight < edge && movementX > 0) {
        direction = 1;
        intensity = (edge - deltaRight) / edge;
      }

      if (direction !== 0) {
        if (scrollFrame.current) cancelAnimationFrame(scrollFrame.current);
        scrollFrame.current = requestAnimationFrame(() => {
          const velocity = Math.max(1, Math.round(intensity * 6));
          container.scrollBy({ left: direction * velocity, behavior: "auto" });
        });
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (scrollFrame.current) cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = null;
    };
  }, [isDragging]);

  // Hit-test de columna por posición de puntero (más confiable en mobile)
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const container = scrollRef.current;
      if (!container) return;

      const columns = container.querySelectorAll("[data-column-id]");
      for (const column of columns) {
        const rect = column.getBoundingClientRect();
        const expanded = {
          left: rect.left - 24,
          right: rect.right + 24,
          top: rect.top,
          bottom: rect.bottom,
        };

        if (
          e.clientX >= expanded.left &&
          e.clientX <= expanded.right &&
          e.clientY >= expanded.top &&
          e.clientY <= expanded.bottom
        ) {
          const colId = column.getAttribute("data-column-id") as ContentTaskStatus | null;
          if (colId) setHoverColumn(colId);
          return;
        }
      }

      setHoverColumn(null);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      setHoverColumn(null);
    };
  }, [isDragging]);

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
      
      // Recargar tareas directamente desde el servidor y fusionar sin perder orden
      try {
        console.log("🔄 Recargando tareas desde getTasks()...");
        const result = await getTasks();
        if (result.success && result.data) {
          // Si hay clientId, filtrar solo las tareas de ese cliente
          const filteredData = clientId 
            ? result.data.filter(t => t.client.id === clientId)
            : result.data;
          console.log("✅ Tareas obtenidas del servidor:", filteredData.length, clientId ? `(filtradas para cliente ${clientId})` : "(todas)");
          
          // Fusionar: preservar el orden local, actualizar datos del servidor
          setTasks((prevTasks) => {
            // Crear un mapa de tareas nuevas por ID para fácil acceso
            const newTasksMap = new Map(filteredData.map(t => [t.id, t]));
            
            // 1. Actualizar tareas existentes con datos nuevos (preservando orden)
            const updatedTasks = prevTasks.map(task => {
              const newTaskData = newTasksMap.get(task.id);
              if (newTaskData) {
                // Fusionar: mantener el orden local, actualizar datos
                return { ...task, ...newTaskData };
              }
              // Si la tarea ya no existe en el servidor, mantenerla
              return task;
            });
            
            // 2. Agregar tareas nuevas que no están en el estado local
            const existingIds = new Set(prevTasks.map(t => t.id));
            const newTasks = filteredData.filter(t => !existingIds.has(t.id));
            
            // 3. Combinar y eliminar cualquier duplicado accidental
            const combined = [...updatedTasks, ...newTasks];
            
            // Verificar que no haya duplicados por ID
            const seenIds = new Set();
            const uniqueTasks = combined.filter(task => {
              if (seenIds.has(task.id)) {
                console.warn("⚠️ Duplicado detectado y eliminado:", task.id);
                return false;
              }
              seenIds.add(task.id);
              return true;
            });
            
            return uniqueTasks;
          });
          
          // Mostrar toast de confirmación (solo si hubo cambios reales)
          toast({
            title: "Actualizado",
            description: "El tablero se ha sincronizado con los últimos cambios",
            duration: 2000,
          });
        } else {
          console.error("❌ Error al obtener tareas:", result.error);
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
          description: "No se pudo actualizar el tablero automáticamente",
        });
      }
    };

    channel.bind("update-event", handleUpdateEvent);

    // Cleanup al desmontar
    return () => {
      console.log("🔌 Desconectando Pusher...");
      pusher.unsubscribe("kanban-channel");
      pusher.disconnect();
    };
  }, [toast]);

  // Función para reordenar tareas localmente
  const reorderTasks = (
    sourceStatus: ContentTaskStatus,
    destinationStatus: ContentTaskStatus,
    sourceIndex: number,
    destinationIndex: number
  ): ContentTaskWithClient[] => {
    // Crear copia profunda para evitar mutaciones accidentales
    const newTasks = [...tasks];
    
    // Encontrar la tarea a mover
    const sourceTasks = newTasks.filter((t) => t.status === sourceStatus);
    const taskToMove = sourceTasks[sourceIndex];
    
    if (!taskToMove) {
      return tasks;
    }
    
    // Crear la tarea actualizada
    const updatedTask = { ...taskToMove, status: destinationStatus };
    
    // Remover la tarea del estado actual
    const taskIndex = newTasks.findIndex((t) => t.id === taskToMove.id);
    if (taskIndex === -1) return tasks;
    newTasks.splice(taskIndex, 1);
    
    // Encontrar la posición de inserción en la columna destino
    let insertIndex = 0;
    
    if (sourceStatus === destinationStatus) {
      // Si es la misma columna, recalcular el índice después de remover
      insertIndex = Math.min(destinationIndex, newTasks.filter((t) => t.status === destinationStatus).length);
    } else {
      // Si es columna diferente, encontrar la posición absoluta
      insertIndex = Math.min(destinationIndex, newTasks.filter((t) => t.status === destinationStatus).length);
    }
    
    // Encontrar el índice absoluto para insertar
    let absoluteIndex = 0;
    for (let i = 0; i < newTasks.length; i++) {
      if (newTasks[i].status === destinationStatus) {
        if (absoluteIndex === insertIndex) {
          newTasks.splice(i, 0, updatedTask);
          return newTasks;
        }
        absoluteIndex++;
      }
    }
    
    // Si no encontramos posición, agregar al final de la columna
    newTasks.push(updatedTask);
    return newTasks;
  };

  // Función OPTIMISTIC para publicar tareas instantáneamente
  const optimisticPublish = async (taskId: string) => {
    // 1. Aplicar optimismo INMEDIATO (milisegundo 1)
    setOptimisticTasks({ taskId, newStatus: "PUBLISHED" });

    // 2. Actualizar estado local también para consistencia
    setTasks((prev) =>
      prev.map((t) => 
        t.id === taskId 
          ? { ...t, status: "PUBLISHED", publishedAt: new Date() } 
          : t
      )
    );

    // 3. Ejecutar Server Action en background
    try {
      const { quickPublishTask } = await import("@/actions/content-actions");
      const result = await quickPublishTask(taskId);

      if (!result.success) {
        // REVERSIÓN: Si falla, volver al estado anterior
        const taskToRevert = tasks.find((t) => t.id === taskId);
        if (taskToRevert) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? { ...taskToRevert, status: taskToRevert.status }
                : t
            )
          );
        }
        
        toast({
          variant: "destructive",
          title: "Error al publicar",
          description: result.error || "No se pudo publicar la tarea",
        });
      } else {
        // ÉXITO: Pusher notificará a otros usuarios
        console.log("✅ Publicación optimista completada en background");
      }
    } catch (error) {
      // REVERSIÓN: Si hay excepción
      const taskToRevert = tasks.find((t) => t.id === taskId);
      if (taskToRevert) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...taskToRevert, status: taskToRevert.status }
              : t
          )
        );
      }
      
      toast({
        variant: "destructive",
        title: "Error de red",
        description: "No se pudo completar la publicación",
      });
    }
  };

  // Función OPTIMISTIC para promover tareas al siguiente estado
  const promoteTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Encontrar el índice del estado actual
    const currentIndex = KANBAN_COLUMNS.findIndex((col) => col.status === task.status);
    
    // Si ya está en el último estado (PUBLISHED), no hacer nada
    if (currentIndex === -1 || currentIndex >= KANBAN_COLUMNS.length - 1) {
      toast({
        variant: "default",
        title: "Sin cambios",
        description: "La tarea ya está en el último estado",
      });
      return;
    }

    const nextStatus = KANBAN_COLUMNS[currentIndex + 1].status;
    const previousTasks = [...tasks];

    // 1. Optimismo: Actualizar localmente (envuelto en startTransition para React 19)
    startTransition(() => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
      );
      setOptimisticTasks({ taskId, newStatus: nextStatus });
    });

    // 2. Llamar al server action
    try {
      const result = await updateTaskStatus(taskId, nextStatus);

      if (!result.success) {
        // REVERSIÓN
        setTasks(previousTasks);
        toast({
          variant: "destructive",
          title: "Error al mover tarea",
          description: result.error || "No se pudo actualizar el estado",
        });
      } else {
        // Dispatch evento para otros componentes
        window.dispatchEvent(
          new CustomEvent("taskStatusUpdated", {
            detail: { taskId, oldStatus: task.status, newStatus: nextStatus },
          })
        );
        console.log(`✅ Tarea promovida: ${task.status} → ${nextStatus}`);
      }
    } catch (error) {
      // REVERSIÓN
      setTasks(previousTasks);
      toast({
        variant: "destructive",
        title: "Error de red",
        description: "No se pudo mover la tarea",
      });
    }
  };
  // Manejar el final del drag con hoverColumn como respaldo
  const handleDragEnd = async (result: DropResult) => {
    setIsDragging(false);

    let destination = result.destination;
    if (!destination && lastPointer.current) {
      const container = scrollRef.current;
      if (container) {
        const { x, y } = lastPointer.current;
        const columns = container.querySelectorAll("[data-column-id]");
        for (const column of columns) {
          const rect = column.getBoundingClientRect();
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            const colId = column.getAttribute("data-column-id") as ContentTaskStatus | null;
            if (colId) {
              destination = {
                droppableId: colId,
                index: optimisticTasks.filter((t) => t.status === colId).length,
              };
            }
            break;
          }
        }
      }
    }

    if (!destination && hoverColumn) {
      destination = { droppableId: hoverColumn, index: optimisticTasks.filter((t) => t.status === hoverColumn).length };
    }

    if (destination && hoverColumn && destination.droppableId !== hoverColumn) {
      destination = {
        droppableId: hoverColumn,
        index: optimisticTasks.filter((t) => t.status === hoverColumn).length,
      };
    }

    if (!destination) {
      setHoverColumn(null);
      return;
    }

    const source = result.source;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      setHoverColumn(null);
      return;
    }

    const sourceStatus = source.droppableId as ContentTaskStatus;
    const destinationStatus = destination.droppableId as ContentTaskStatus;

    const taskToMove = tasks.find((task) => task.id === result.draggableId && task.status === sourceStatus);
    if (!taskToMove) {
      setHoverColumn(null);
      return;
    }

    const previousTasks = [...tasks];
    const optimistic = reorderTasks(sourceStatus, destinationStatus, source.index, destination.index);
    setTasks(optimistic);

    if (sourceStatus !== destinationStatus) {
      try {
        const resultUpdate = await updateTaskStatus(taskToMove.id, destinationStatus);
        if (!resultUpdate.success) {
          setTasks(previousTasks);
          toast({
            variant: "destructive",
            title: "Error al actualizar tarea",
            description: resultUpdate.error || "No se pudo actualizar el estado",
          });
        } else {
          window.dispatchEvent(
            new CustomEvent("taskStatusUpdated", {
              detail: { taskId: taskToMove.id, oldStatus: sourceStatus, newStatus: destinationStatus },
            })
          );
        }
      } catch (error) {
        setTasks(previousTasks);
        toast({
          variant: "destructive",
          title: "Error al actualizar tarea",
          description: error instanceof Error ? error.message : "Ocurrió un error inesperado",
        });
      }
    }

    setHoverColumn(null);
  };

  const handleDragUpdate = (update: DragUpdate) => {
    if (!update.destination) return;
    const droppableId = update.destination.droppableId as ContentTaskStatus | undefined;
    if (droppableId && droppableId !== hoverColumn) {
      setHoverColumn(droppableId);
    }
  };

  // Filtrar tareas por estado (usando optimisticTasks si existe)
  const tasksByStatus = KANBAN_COLUMNS.reduce(
    (acc, column) => {
      acc[column.status] = optimisticTasks.filter((task) => task.status === column.status);
      return acc;
    },
    {} as Record<ContentTaskStatus, ContentTaskWithClient[]>
  );

  // Si no está montado, mostrar versión estática (sin drag & drop)
  // Usamos una versión simplificada sin Droppable para evitar errores de contexto
  if (!isMounted) {
    return (
      <div className="w-full h-full overflow-visible">
        {/* Mobile: scroll horizontal | Desktop: grid con columnas fijas */}
        <div className="flex md:grid md:grid-cols-6 md:gap-4 w-full h-full items-start overflow-x-auto md:overflow-x-auto md:overflow-y-hidden pb-6 md:pb-0">
          {KANBAN_COLUMNS.map((column) => {
            const columnTasks = tasksByStatus[column.status] || [];

            return (
              <div
                key={column.status}
                className="flex flex-col min-w-[40vw] sm:min-w-[350px] md:min-w-0 md:w-full md:flex-1 snap-center flex-shrink-0 first:ml-4 last:mr-4 px-2 md:px-0 h-full"
              >
                <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-90/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="sticky top-0 z-30 w-full bg-white dark:bg-slate-900 py-2 px-2 md:py-2 md:px-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between rounded-t-xl">
                    <h3 className="font-semibold text-xs md:text-sm truncate">
                      {column.label}
                    </h3>
                    <Badge variant="secondary" className="ml-2 flex-shrink-0 text-[10px] md:text-xs">
                      {columnTasks.length}
                    </Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide">
                    <div className="flex flex-col gap-3 p-3 w-full overflow-hidden">
                      {columnTasks.length > 0 ? (
                        columnTasks.map((task) => (
                          <div key={task.id}>
                            {/* Versión simplificada sin Draggable para estado no montado */}
                            <Card className="border-l-2 md:border-l-4 cursor-pointer hover:shadow-md transition-all max-w-full overflow-hidden"
                              style={{
                                borderLeftColor: `${task.client.color || "#000000"}80`,
                              }}
                              onClick={() => {
                                setSelectedTask(task);
                                setIsSheetOpen(true);
                              }}
                            >
                              <CardContent className="p-2 md:p-2">
                                {task.status === "PUBLISHED" ? (
                                  <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                      <h4 className="font-semibold text-[10px] md:text-xs leading-tight line-clamp-2">
                                        {task.title}
                                      </h4>
                                      <div className="text-[9px] md:text-[10px] text-muted-foreground truncate">
                                        {task.client.name}
                                      </div>
                                    </div>
                                    <CheckCircle2 className="h-3 w-3 md:h-4 md:w-4 text-emerald-500 flex-shrink-0 ml-2" />
                                  </div>
                                ) : (
                                  <>
                                    <h4 className="font-semibold text-xs md:text-xs leading-tight line-clamp-2 pr-6">
                                      {task.title}
                                    </h4>
                                    <div className="flex items-center gap-1 flex-wrap mt-1">
                                      <Badge variant="outline" className="text-[9px] md:text-[10px] px-1 py-0">
                                        {task.client.name}
                                      </Badge>
                                    </div>
                                  </>
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-md border border-dashed p-3 text-center text-[9px] md:text-[10px] text-muted-foreground bg-muted/5">
                          Sin tareas
                        </div>
                      )}
                    </div>
                  </div>
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
    <DragDropContext
      onDragStart={() => setIsDragging(true)}
      onDragUpdate={handleDragUpdate}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full h-full overflow-visible">
        {/* Mobile: scroll horizontal 98vw | Desktop: grid con columnas fijas */}
        <div
          ref={scrollRef}
          className="flex md:grid md:grid-cols-6 md:gap-4 w-[98vw] md:w-full h-full items-start overflow-x-auto overflow-y-visible md:overflow-x-auto md:overflow-y-hidden pb-6 md:pb-0"
        >
          {KANBAN_COLUMNS.map((column) => {
            const columnTasks = tasksByStatus[column.status] || [];

            return (
              <KanbanColumn
                key={column.status}
                status={column.status}
                label={column.label}
                tasks={columnTasks}
                onCardClick={(task) => {
                  setSelectedTask(task);
                  setIsSheetOpen(true);
                }}
                optimisticPublish={optimisticPublish}
                onPromoteTask={promoteTask}
                isCompactView={isCompactView}
              />
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