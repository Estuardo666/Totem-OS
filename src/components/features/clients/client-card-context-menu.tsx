"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
import {
  ArrowRight,
  ClipboardCopy,
  Edit3,
  Link2,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { updateClient, deleteClient } from "@/actions/client-actions";

const CLIENT_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Activo" },
  { value: "PAUSED", label: "Pausado" },
  { value: "DEBT", label: "En deuda" },
  { value: "INACTIVE", label: "Inactivo" },
] as const;

type ClientStatus = (typeof CLIENT_STATUS_OPTIONS)[number]["value"];

interface ClientMenuTarget {
  id: string;
  name: string;
  status: string;
  color?: string | null;
}

interface ClientCardContextMenuProps {
  children: ReactNode;
  client: ClientMenuTarget;
  onEdit: () => void;
  canEdit?: boolean;
  isAdmin?: boolean;
}

export function ClientCardContextMenu({
  children,
  client,
  onEdit,
  canEdit = false,
  isAdmin = false,
}: ClientCardContextMenuProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleStatusChange = async (status: ClientStatus) => {
    if (status === client.status) return;
    const statusLabel =
      CLIENT_STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
    setIsProcessing(true);
    toast({
      title: "Actualizando...",
      description: "Se esta cambiando el estado del cliente.",
    });
    try {
      const result = await updateClient(client.id, { status });
      if (result.success) {
        toast({
          title: "Estado actualizado",
          description: `Cliente marcado como ${statusLabel.toLowerCase()}.`,
        });
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo actualizar el estado.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar el estado.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDuplicate = () => {
    toast({
      title: "Accion en desarrollo",
      description: "Duplicar cliente",
    });
  };

  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      const result = await deleteClient(client.id);
      if (result.success) {
        toast({
          title: "Cliente eliminado",
          description: "Se elimino el cliente correctamente.",
        });
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo eliminar el cliente.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el cliente.",
      });
    } finally {
      setIsProcessing(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent
          className="w-60"
          style={{
            "--client-color": client.color || "#3b82f6",
          } as CSSProperties}
        >
          <ContextMenuItem onClick={() => router.push(`/clients/${client.id}`)}>
            <Link2 className="mr-2 h-3.5 w-3.5" />
            Abrir ficha completa
          </ContextMenuItem>

          <ContextMenuItem onClick={onEdit} disabled={!canEdit}>
            <Edit3 className="mr-2 h-3.5 w-3.5" />
            Editar datos
          </ContextMenuItem>

          <ContextMenuItem onClick={handleDuplicate}>
            <ClipboardCopy className="mr-2 h-3.5 w-3.5" />
            Duplicar cliente
          </ContextMenuItem>

          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <ArrowRight className="mr-2 h-3.5 w-3.5" />
              Cambiar estado
            </ContextMenuSubTrigger>
            <ContextMenuSubContent
              style={{
                "--client-color": client.color || "#3b82f6",
              } as CSSProperties}
            >
              {CLIENT_STATUS_OPTIONS.map((status) => (
                <ContextMenuItem
                  key={status.value}
                  onClick={() => handleStatusChange(status.value)}
                  disabled={status.value === client.status || isProcessing}
                >
                  {status.label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={() => setShowDeleteDialog(true)}
            variant="destructive"
            disabled={!isAdmin || isProcessing}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Eliminar
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion eliminara permanentemente a {client.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
