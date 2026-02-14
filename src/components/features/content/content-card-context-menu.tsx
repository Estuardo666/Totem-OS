"use client";

import { useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import {
  Pencil,
  Copy,
  ArrowRight,
  Users,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import type { ContentTaskWithClient } from "@/actions/content-actions";
import {
  duplicateTask,
  updateTaskStatus,
  deleteTask,
  updateTaskClient,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ContentCardContextMenuProps {
  children: React.ReactNode;
  task: ContentTaskWithClient;
  clients?: Array<{ id: string; name: string; logo?: string | null }>;
  onEdit: () => void;
  onOptimisticStatusChange?: (taskId: string, newStatus: ContentTaskStatus) => Promise<void>;
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
  clients = [],
  onEdit,
  onOptimisticStatusChange,
}: ContentCardContextMenuProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [notes, setNotes] = useState("");
  const [selectedClientId, setSelectedClientId] = useState(task.clientId);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDuplicate = async () => {
    // Mostrar feedback inmediato
    toast({
      title: "Duplicando...",
      description: "Se está creando la copia",
    });
    
    // Refrescar inmediatamente para preparar la UI
    router.refresh();
    
    // Ejecutar la acción en segundo plano
    duplicateTask(task.id).then((result) => {
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Contenido duplicado exitosamente",
        });
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Error al duplicar",
        });
      }
    }).catch(() => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al duplicar el contenido",
      });
    });
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

  const handleClientChange = () => {
    if (selectedClientId === task.clientId) {
      setShowClientDialog(false);
      return;
    }

    setIsProcessing(true);
    setShowClientDialog(false);
    
    // Feedback instantáneo
    toast({
      title: "Actualizando...",
      description: "Se está cambiando el cliente",
    });
    
    // Refrescar inmediatamente
    router.refresh();
    
    // Ejecutar en segundo plano
    updateTaskClient(task.id, selectedClientId).then((result) => {
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Cliente actualizado",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Error al actualizar cliente",
        });
        router.refresh();
      }
    }).catch(() => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al actualizar cliente",
      });
      router.refresh();
    }).finally(() => {
      setIsProcessing(false);
    });
  };

  const handleAddNotes = () => {
    setNotes(task.postCopy?.includes("--- NOTAS ---") 
      ? task.postCopy.split("--- NOTAS ---")[1]?.trim() || ""
      : ""
    );
    setShowNotesDialog(true);
  };

  const handleSaveNotes = () => {
    setIsProcessing(true);
    setShowNotesDialog(false);
    
    // Feedback instantáneo
    toast({
      title: "Guardando...",
      description: "Se están guardando las notas",
    });
    
    // Refrescar inmediatamente
    router.refresh();
    
    // Preparar datos
    const currentCopy = task.postCopy?.split("--- NOTAS ---")[0]?.trim() || "";
    const newPostCopy = notes 
      ? `${currentCopy}\n\n--- NOTAS ---\n${notes}`.trim()
      : currentCopy;
    
    // Ejecutar en segundo plano
    import("@/actions/content-actions").then(({ updateTask }) => {
      return updateTask(task.id, { postCopy: newPostCopy });
    }).then((result) => {
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Notas guardadas",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Error al guardar notas",
        });
        router.refresh();
      }
    }).catch(() => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al guardar notas",
      });
      router.refresh();
    }).finally(() => {
      setIsProcessing(false);
    });
  };

  return (
    <>
      <ContextMenu>
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

          {/* Duplicar */}
          <ContextMenuItem onClick={handleDuplicate}>
            <Copy className="mr-2 h-3.5 w-3.5" />
            Duplicar
            <ContextMenuShortcut>⌘D</ContextMenuShortcut>
          </ContextMenuItem>

          {/* Mover a... */}
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <ArrowRight className="mr-2 h-3.5 w-3.5" />
              Mover a...
            </ContextMenuSubTrigger>
            <ContextMenuSubContent
              style={
                {
                  "--client-color": task.client?.color || "#3b82f6",
                } as React.CSSProperties
              }
            >
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
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />

          {/* Asignar Cliente */}
          {clients.length > 0 && (
            <ContextMenuItem onClick={() => setShowClientDialog(true)}>
              <Users className="mr-2 h-3.5 w-3.5" />
              Asignar Cliente
            </ContextMenuItem>
          )}

          {/* Añadir Notas */}
          <ContextMenuItem onClick={handleAddNotes}>
            <StickyNote className="mr-2 h-3.5 w-3.5" />
            Añadir Notas
          </ContextMenuItem>

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

      {/* Notes Dialog */}
      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notas para {task.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                placeholder="Escribe tus notas aquí..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={6}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowNotesDialog(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveNotes} disabled={isProcessing}>
              {isProcessing ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Assignment Dialog */}
      <Dialog open={showClientDialog} onOpenChange={setShowClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="client">Cliente</Label>
              <Select
                value={selectedClientId}
                onValueChange={setSelectedClientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowClientDialog(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleClientChange} disabled={isProcessing}>
              {isProcessing ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
