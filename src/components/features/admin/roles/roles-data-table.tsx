"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { deleteRole } from "@/actions/admin/role-actions";
import { RoleSheet } from "./role-sheet";
import type { Role } from "@prisma/client";

// Tipo extendido para incluir conteo de usuarios
type RoleWithUserCount = Role & {
  _count?: {
    users: number;
  };
};

interface RolesDataTableProps {
  roles: RoleWithUserCount[];
}

export function RolesDataTable({ roles }: RolesDataTableProps) {
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setIsSheetOpen(true);
  };

  const handleDelete = async (roleId: string, roleName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el rol "${roleName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const result = await deleteRole(roleId);

      if (result.success) {
        toast({
          title: "Rol eliminado",
          description: `El rol "${roleName}" ha sido eliminado correctamente.`,
        });
        router.refresh();
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
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado",
      });
    }
  };

  return (
    <>
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Usuarios</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead className="text-right w-20">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No hay roles registrados
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">
                    <Badge variant="secondary">{role.name}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {role.description || "Sin descripción"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {role._count?.users || 0} usuario(s)
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(role.createdAt), "dd/MM/yyyy", { locale: es })}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleEdit(role)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar rol
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(role.id, role.name)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar rol
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Sheet de edición */}
      {isSheetOpen && editingRole && (
        <RoleSheet
          role={editingRole}
          mode="edit"
          trigger={null}
        />
      )}
    </>
  );
}

