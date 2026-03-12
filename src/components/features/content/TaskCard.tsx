"use client";

import { format, isToday } from "date-fns";
import { Video, Image as ImageIconLucide, Camera, ImageIcon, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  Draggable,
  DraggableProvided,
  DraggableStateSnapshot,
} from "@hello-pangea/dnd";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ContentCardContextMenu } from "./content-card-context-menu";
import { useEffect, useState } from "react";

function getUserInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

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

interface TaskCardProps {
  task: ContentTaskWithClient;
  index: number;
  onCardClick: (task: ContentTaskWithClient) => void;
  optimisticPublish: (taskId: string) => Promise<void>;
  onPromoteTask?: (taskId: string) => Promise<void>;
  onOptimisticStatusChange?: (taskId: string, newStatus: import("@/types").ContentTaskStatus) => Promise<void>;
  isCompactView?: boolean;
  clients?: Array<{ id: string; name: string; logo?: string | null }>;
}

export function TaskCard({ task, index, onCardClick, onOptimisticStatusChange, isCompactView = false, clients = [] }: TaskCardProps) {
  const isPublishing = false;
  const isEditorStage = ["RECORDED", "EDITING", "REVIEW_INTERNAL", "REVIEW_CLIENT"].includes(task.status);
  const hasMissingScheduleWarning = isEditorStage && !task.scheduledAt && !task.dueDate;
  const [isMobile, setIsMobile] = useState(false);

  // Detectar dispositivo móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Para TODAS las tareas: Envolver en Draggable
  const isDragDisabled = isPublishing;
  const showOnlyCommunityAvatar = task.status === "IDEA" || task.status === "RECORDED";
  const shouldShowAssignedAvatars = task.status !== "PUBLISHED" && (
    showOnlyCommunityAvatar
      ? Boolean(task.assignedCommunity)
      : Boolean(task.assignedEditor || task.assignedCommunity)
  );

  // Si debe desaparecer, no renderizar nada
  if (isPublishing) {
    return null;
  }

  return (
    <Draggable draggableId={task.id} index={index} isDragDisabled={isDragDisabled}>
      {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
        // Contenedor raíz del Draggable (sin animación)
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          data-task-id={task.id}
          className={`${snapshot.isDragging ? "z-50" : ""}`}
          style={{
            ...provided.draggableProps.style,
            touchAction: snapshot.isDragging ? "none" : "manipulation",
          }}
        >
          {/* Contenedor hijo con animación de desaparición fantasma + fade al cambiar vista */}
          <div
            className={`
              ${snapshot.isDragging
                ? "transition-none duration-0"
                : "transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"}
              ${isPublishing
                ? "opacity-0 scale-90 translate-y-4 blur-sm pointer-events-none"
                : "opacity-100 scale-100 translate-y-0 blur-0"}
              animate-fade-in-view
            `}
          >
            <ContentCardContextMenu
              task={task}
              clients={clients}
              onEdit={() => onCardClick(task)}
              onOptimisticStatusChange={onOptimisticStatusChange}
            >
              <Card
                className={`relative max-w-full overflow-hidden border transition-all duration-200 ${
                  snapshot.isDragging
                    ? "cursor-grabbing shadow-lg ring-2 ring-primary z-50 scale-[1.02] opacity-95"
                    : "cursor-grab hover:shadow-md"
                } ${
                  task.status === "REVIEW_CLIENT" || task.status === "APPROVED" || task.status === "CLIENT_APPROVED"
                    ? "bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-200 dark:ring-emerald-800"
                    : ""
                } ${
                  task.status === "PUBLISHED"
                    ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                    : ""
                } ${
                  hasMissingScheduleWarning
                    ? "ring-1 ring-amber-300 bg-amber-50/60 dark:bg-amber-950/20"
                    : ""
                }`}
                style={{
                  borderColor: `${task.client.color || "#000000"}80`,
                  userSelect: snapshot.isDragging ? "none" : "auto",
                  WebkitUserSelect: snapshot.isDragging ? "none" : "auto",
                  touchAction: snapshot.isDragging ? "none" : "manipulation",
                }}
                onClick={(e) => {
                  // Si estamos publicando o arrastrando, no hacer nada
                  if (isPublishing || snapshot.isDragging) {
                    e.stopPropagation();
                    return;
                  }

                  // En mobile, abrir menú contextual con toque normal
                  if (isMobile) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Forzar el menú contextual directamente
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX || (rect.left + rect.width / 2);
                    const y = e.clientY || (rect.top + rect.height / 2);
                    
                    // Simular el right-click para el ContextMenu de shadcn
                    const mouseEvent = new MouseEvent('contextmenu', {
                      bubbles: true,
                      cancelable: true,
                      clientX: x,
                      clientY: y,
                      button: 2
                    });
                    
                    e.currentTarget.dispatchEvent(mouseEvent);
                    return;
                  }

                  // En desktop, comportamiento normal
                  if (task.status === "PUBLISHED") {
                    e.stopPropagation();
                    onCardClick(task);
                    return;
                  }

                  e.stopPropagation();
                  onCardClick(task);
                }}
                onContextMenu={(e) => {
                  // Prevenir menú contextual por defecto en mobile para evitar doble menú
                  if (isMobile) {
                    e.preventDefault();
                  }
                }}
              >
                {shouldShowAssignedAvatars && (
                  <div className="absolute top-2 right-2 z-20 flex flex-col items-center gap-1">
                    {!showOnlyCommunityAvatar && task.assignedEditor && (
                      <Avatar className="h-5 w-5" title={`Editor: ${task.assignedEditor.name}`}>
                        <AvatarImage src={task.assignedEditor.image || undefined} alt={task.assignedEditor.name} />
                        <AvatarFallback className="text-[9px] font-semibold">
                          {getUserInitials(task.assignedEditor.name)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    {task.assignedCommunity && (
                      <Avatar className="h-5 w-5" title={`Community: ${task.assignedCommunity.name}`}>
                        <AvatarImage src={task.assignedCommunity.image || undefined} alt={task.assignedCommunity.name} />
                        <AvatarFallback className="text-[9px] font-semibold">
                          {getUserInitials(task.assignedCommunity.name)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                )}

                <CardContent className="p-[0.45rem]">
                  {/* Para tareas publicadas: Vista compacta minimalista */}
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
                    // Para tareas NO publicadas: Vista completa
                    <>
                      {/* Título con padding para evitar superposición con checkbox */}
                      <h4 className="font-semibold text-xs md:text-xs leading-tight line-clamp-2 pr-7">
                        {task.title}
                      </h4>

                      {/* Cliente */}
                      <div className="flex items-center gap-1 flex-wrap mt-1">
                        <Badge variant="outline" className="text-[9px] md:text-[10px] px-1 py-0">
                          {task.client.name}
                        </Badge>
                        {(task.status === "REVIEW_CLIENT" || task.status === "APPROVED" || task.status === "CLIENT_APPROVED") && (
                          <Badge
                            variant="default"
                            className="text-[9px] md:text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 px-1 py-0"
                          >
                            {task.status === "CLIENT_APPROVED" && (
                              <CheckCircle2 className="h-2 w-2 md:h-2.5 md:w-2.5" />
                            )}
                            {task.status === "REVIEW_CLIENT"
                              ? "En Rev."
                              : task.status === "CLIENT_APPROVED"
                              ? "Aprobado"
                              : "Aprobado"}
                          </Badge>
                        )}
                        {task.client.brandAssets && task.client.brandAssets.length > 0 && (
                          <div
                            className="flex items-center"
                            title={`${task.client.brandAssets.length} recursos de marca disponibles`}
                          >
                            <ImageIcon className="h-2 w-2 md:h-2.5 md:w-2.5 text-primary" />
                          </div>
                        )}
                      </div>

                      {/* Tipo e Icono - Oculto en vista compacta */}
                      {!isCompactView && (
                        <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-muted-foreground mt-1">
                          {getTypeIcon(task.type)}
                          <span className="truncate">{getTypeLabel(task.type)}</span>
                        </div>
                      )}

                      {hasMissingScheduleWarning && (
                        <div className="mt-1 flex items-center gap-1 text-[9px] md:text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                          <span className="truncate">Falta fecha de entrega</span>
                        </div>
                      )}

                      {/* Fecha de entrega interna - Oculta en vista compacta y en IDEA/Guión */}
                      {!isCompactView && task.scheduledAt && task.status !== "IDEA" && (
                        <div className={`text-[9px] md:text-[10px] flex items-center gap-1 mt-1 ${
                          isToday(new Date(task.scheduledAt))
                            ? "text-orange-600 font-semibold"
                            : "text-muted-foreground"
                        }`}>
                          <span>📅</span>
                          <span className="truncate">
                            {format(new Date(task.scheduledAt), "dd MMM")}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </ContentCardContextMenu>
          </div>
        </div>
      )}
    </Draggable>
  );
}