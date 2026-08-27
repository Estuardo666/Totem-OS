"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EditUserDialog } from "./edit-user-dialog";
import { SalaryConfigCard } from "@/components/features/team/salary-config-card";
import type { UserWithTaskCount } from "@/actions/user.actions";

interface UsersTableProps {
  users: UserWithTaskCount[];
}

export function UsersTable({ users }: UsersTableProps) {
  const [editingUser, setEditingUser] = useState<UserWithTaskCount | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleEdit = (user: UserWithTaskCount) => {
    setEditingUser(user);
    setIsDialogOpen(true);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
  };

  const getRoleBadgeVariant = (role: string) => {
    return role === "ADMIN" ? "default" : "secondary";
  };

  const getSpecialtyLabel = (specialty: string | null | undefined) => {
    if (!specialty) return "Sin especialidad";
    return specialty === "EDITOR" ? "Editor" : "Community Manager";
  };

  const getWorkloadBadge = (user: UserWithTaskCount) => {
    const taskCount = (user._count?.tasksAsEditor || 0) + (user._count?.tasksAsCommunity || 0);
    const badge = (() => {
      if (taskCount === 0) {
        return <Badge variant="outline">0</Badge>;
      }
      if (taskCount > 10) {
        return (
          <Badge variant="destructive" className="gap-1 cursor-pointer">
            🔥 {taskCount}
          </Badge>
        );
      }
      if (taskCount > 5) {
        return (
          <Badge variant="secondary" className="gap-1 bg-yellow-500/90 text-yellow-900 hover:bg-yellow-500 dark:bg-yellow-900/80 dark:text-yellow-100 cursor-pointer">
            ⚠️ {taskCount}
          </Badge>
        );
      }
      return <Badge variant="secondary" className="cursor-pointer">{taskCount}</Badge>;
    })();

    // Si no hay tareas, solo mostrar el badge sin popover
    if (taskCount === 0) {
      return badge;
    }

    // Si hay tareas, mostrar tooltip simple (no tenemos preview de tareas específicas por relación)
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p>Total de tareas activas: {taskCount}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Especialidad</TableHead>
              <TableHead>Carga Actual</TableHead>
              <TableHead>Fecha de Creación</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No hay usuarios registrados
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.roleLegacy)}>
                      {user.roleLegacy}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getSpecialtyLabel(user.specialty)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {getWorkloadBadge(user)}
                  </TableCell>
                  <TableCell>
                    {format(new Date(user.createdAt), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(user)}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Tarjetas de configuración de tarifas (solo para ADMIN) */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user) => (
          <SalaryConfigCard key={user.id} user={user} />
        ))}
      </div>

      {editingUser && (
        <EditUserDialog
          user={editingUser}
          open={isDialogOpen}
          onOpenChange={handleClose}
        />
      )}
    </TooltipProvider>
  );
}

