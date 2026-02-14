"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Eye, Lock, Power, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { AdminUserWithRelations } from "@/actions/admin/user-actions";
import type { ReactNode } from "react";

interface UserRowContextMenuProps {
  children: ReactNode;
  user: AdminUserWithRelations;
  onEdit: () => void;
  onDelete: () => void;
}

export function UserRowContextMenu({
  children,
  user,
  onEdit,
  onDelete,
}: UserRowContextMenuProps) {
  const { toast } = useToast();

  const handleQuickAction = (label: string) => {
    toast({
      title: "Accion en desarrollo",
      description: label,
    });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent
        className="w-60"
        style={{
          "--client-color": user.primaryColor || "#3b82f6",
        } as React.CSSProperties}
      >
        <ContextMenuItem onClick={onEdit}>
          <Eye className="mr-2 h-3.5 w-3.5" />
          Ver perfil
        </ContextMenuItem>
        <ContextMenuItem onClick={onEdit}>
          <UserCog className="mr-2 h-3.5 w-3.5" />
          Editar permisos
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleQuickAction("Asignar rol")}> 
          <ShieldCheck className="mr-2 h-3.5 w-3.5" />
          Asignar rol
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleQuickAction("Activar o desactivar")}> 
          <Power className="mr-2 h-3.5 w-3.5" />
          Activar / Desactivar
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleQuickAction("Bloquear inicio de sesion")}> 
          <Lock className="mr-2 h-3.5 w-3.5" />
          Bloquear inicio de sesion
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onDelete} variant="destructive">
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Eliminar
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
