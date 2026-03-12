"use client";

import { useEffect, useState } from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import {
  Pencil,
  ArrowRight,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import {
  updateTaskStatus,
  deleteTask,
} from "@/actions/content-actions";
import type { ContentTaskStatus } from "@/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ContentCardContextMenuProps {
  children: React.ReactNode;
  task: ContentTaskWithClient;
  clients?: Array<{ id: string; name: string; logo?: string | null }>;
  onEdit: () => void;
  onOptimisticStatusChange?: (taskId: string, newStatus: ContentTaskStatus) => Promise<void>;
  mobileOpenSignal?: number;
}

const STATUS_OPTIONS: Array<{ value: ContentTaskStatus; label: string; emoji: string }> = [
  { value: "IDEA", label: "Guión", emoji: "💡" },
  { value: "RECORDED", label: "Grabado", emoji: "🎬" },
  { value: "EDITING", label: "Editando", emoji: "✂️" },
  { value: "REVIEW_CLIENT", label: "Revisión Cliente", emoji: "👀" },
  { value: "CLIENT_APPROVED", label: "Aprobado por Cliente", emoji: "✅" },
  { value: "PUBLISHED", label: "Publicado", emoji: "🚀" },
];

export function ContentCardContextMenu({
  children,
  task,
  clients: _clients = [],
  onEdit,
  onOptimisticStatusChange,
  mobileOpenSignal = 0,
}: ContentCardContextMenuProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMoveAccordion, setShowMoveAccordion] = useState(false);
  const [open, setOpen] = useState(false);

  // Abrir en mobile cuando se recibe la señal desde el touch
  useEffect(() => {
    if (mobileOpenSignal > 0) {
      setOpen(true);
    }
  }, [mobileOpenSignal]);

  const handleMove = (newStatus: ContentTaskStatus) => {
    if (newStatus === task.status) return;

    const statusLabel = STATUS_OPTIONS.find(s => s.value === newStatus)?.label;
    
    // Si tenemos actualización optimista, usarla (instantáneo)
    if (onOptimisticStatusChange) {
      onOptimisticStatusChange(task.id, newStatus);
      toast({
        title: "Éxito",
        description: `Movido a ${statusLabel}`,
      });
      return;
    }
    
    // Fallback: comportamiento anterior con router.refresh()
    toast({
      title: "Moviendo...",
      description: `A ${statusLabel}`,
    });
    
    router.refresh();
    
    updateTaskStatus(task.id, newStatus).then((result) => {
      if (result.success) {
        toast({
          title: "Éxito",
          description: `Movido a ${statusLabel}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Error al mover",
        });
        router.refresh();
      }
    }).catch(() => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al mover el contenido",
      });
      router.refresh();
    });
  };

  const handleDelete = () => {
    setIsDeleting(true);
    setShowDeleteDialog(false);
    
    // Feedback instantáneo
    toast({
      title: "Eliminando...",
      description: "Se está eliminando el contenido",
    });
    
    // Refrescar inmediatamente
    router.refresh();
    
    // Ejecutar eliminación en segundo plano
    deleteTask(task.id).then((result) => {
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Contenido eliminado",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Error al eliminar",
        });
        router.refresh();
      }
    }).catch(() => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al eliminar el contenido",
      });
      router.refresh();
    }).finally(() => {
      setIsDeleting(false);
    });
  };

  return (
    <>
      <ContextMenuPrimitive.Root open={open} onOpenChange={setOpen}>
        <ContextMenuTrigger asChild>
          {children}
        </ContextMenuTrigger>

        <ContextMenuContent 
          className="w-56"
          style={
            {
              "--client-color": task.client?.color || "#3b82f6",
            } as React.CSSProperties
          }
        >
          {/* Editar */}
          <ContextMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Editar
            <ContextMenuShortcut>E</ContextMenuShortcut>
          </ContextMenuItem>

          {/* Mover a... */}
          <div className="overflow-hidden rounded-[0.75rem] transition-all duration-200 ease-out data-[open=true]:bg-accent/40">
            <ContextMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setShowMoveAccordion((prev) => !prev);
              }}
              className="group"
              data-open={showMoveAccordion}
            >
              <ArrowRight className="mr-2 h-3.5 w-3.5" />
              Mover a...
              <ChevronDown
                className={`ml-auto h-4 w-4 transition-transform duration-200 ${showMoveAccordion ? "rotate-180" : "rotate-0"}`}
              />
            </ContextMenuItem>

            <div
              className={`grid transition-all duration-200 ease-out ${showMoveAccordion ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"}`}
            >
              <div className="overflow-hidden">
                <div className="ml-2 space-y-1 border-l border-border/60 pl-2">
                  {STATUS_OPTIONS.map((status) => (
                    <ContextMenuItem
                      key={status.value}
                      onClick={() => handleMove(status.value)}
                      disabled={status.value === task.status}
                      className={status.value === task.status ? "opacity-50" : ""}
                    >
                      <span className="mr-1.5 text-sm">{status.emoji}</span>
                      {status.label}
                    </ContextMenuItem>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <ContextMenuSeparator />

          {/* Eliminar */}
          <ContextMenuItem
            onClick={() => setShowDeleteDialog(true)}
            variant="destructive"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Eliminar
            <ContextMenuShortcut>⌫</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenuPrimitive.Root>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar contenido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente{" "}
              <strong>{task.title}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
