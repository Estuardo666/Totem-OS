"use client";

import { useEffect, useRef, useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
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
}

const STATUS_OPTIONS: Array<{ value: ContentTaskStatus; label: string }> = [
  { value: "IDEA", label: "Guión" },
  { value: "RECORDED", label: "Grabado" },
  { value: "EDITING", label: "Editando" },
  { value: "REVIEW_CLIENT", label: "Revisión Cliente" },
  { value: "CLIENT_APPROVED", label: "Aprobado por Cliente" },
  { value: "PUBLISHED", label: "Publicado" },
];

export function ContentCardContextMenu({
  children,
  task,
  onEdit,
  onOptimisticStatusChange,
}: ContentCardContextMenuProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isMobile, setIsMobile] = useState(false);
  const allowNextContextMenuRef = useRef(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isMoveExpanded, setIsMoveExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mediaQuery.matches);
    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, []);

  const openContextMenu = (target: HTMLDivElement, clientX: number, clientY: number) => {
    allowNextContextMenuRef.current = true;
    target.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
      })
    );
  };

  const handleMobileClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMobile) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX > 0 ? e.clientX : rect.left + rect.width / 2;
    const clientY = e.clientY > 0 ? e.clientY : rect.top + rect.height / 2;

    openContextMenu(e.currentTarget, clientX, clientY);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    if (allowNextContextMenuRef.current) {
      allowNextContextMenuRef.current = false;
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

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
      <ContextMenu
        onOpenChange={(open) => {
          if (!open) setIsMoveExpanded(false);
        }}
      >
        <ContextMenuTrigger asChild>
          <div onClickCapture={handleMobileClickCapture} onContextMenu={handleContextMenu}>
            {children}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent 
          className="w-40 text-[15px]"
          style={
            {
              "--client-color": task.client?.color || "#3b82f6",
            } as React.CSSProperties
          }
        >
          {/* Editar */}
          <ContextMenuItem onClick={onEdit} className="text-[15px]">
            Editar
            <ContextMenuShortcut>E</ContextMenuShortcut>
          </ContextMenuItem>

          {/* Mover a... (acordeón dentro del mismo menú) */}
          <ContextMenuItem
            className="text-[15px]"
            onSelect={(event) => {
              event.preventDefault();
              setIsMoveExpanded((prev) => !prev);
            }}
          >
            <span>Mover a...</span>
            <span
              className={`ml-auto text-[11px] opacity-70 transition-transform duration-200 ${
                isMoveExpanded ? "rotate-180" : ""
              }`}
            >
              ▼
            </span>
          </ContextMenuItem>

          <div
            className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isMoveExpanded ? "max-h-80 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
            }`}
          >
            <div className="mt-0.5 px-1 pb-1">
              {STATUS_OPTIONS.map((status) => (
                <ContextMenuItem
                  key={status.value}
                  inset
                  onSelect={() => {
                    setIsMoveExpanded(false);
                    handleMove(status.value);
                  }}
                  disabled={status.value === task.status}
                  className={status.value === task.status ? "text-[15px] opacity-50" : "text-[15px]"}
                >
                  <span className="truncate">{status.label}</span>
                </ContextMenuItem>
              ))}
            </div>
          </div>

          <ContextMenuSeparator />

          {/* Eliminar */}
          <ContextMenuItem
            onClick={() => setShowDeleteDialog(true)}
            variant="destructive"
            className="text-[15px]"
          >
            Eliminar
            <ContextMenuShortcut>⌫</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

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
