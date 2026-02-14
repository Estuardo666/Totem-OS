"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { deleteUser } from "@/actions/admin/user-actions";
import { UserSheet } from "./user-sheet";
import type { AdminUserWithRelations } from "@/actions/admin/user-actions";
import { UserRowContextMenu } from "./user-row-context-menu";

interface UsersDataTableProps {
  users: AdminUserWithRelations[];
}

export function UsersDataTable({ users }: UsersDataTableProps) {
  const [editingUser, setEditingUser] = useState<AdminUserWithRelations | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleEdit = (user: AdminUserWithRelations) => {
    setEditingUser(user);
    setIsSheetOpen(true);
  };

  const handleSheetChange = (open: boolean) => {
    setIsSheetOpen(open);
    if (!open) {
      // Pequeño delay para evitar flickering visual al cerrar
      setTimeout(() => setEditingUser(null), 200);
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`¿Eliminar a "${userName}"?`)) return;

    try {
      const result = await deleteUser(userId);
      if (result.success) {
        toast({ title: "Eliminado", description: `Usuario "${userName}" eliminado.` });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Error inesperado" });
    }
  };

  const getRoleBadgeVariant = (roleName: string) => {
    if (roleName === "ADMIN") return "default";
    return "secondary";
  };

  const getTaskCount = (user: AdminUserWithRelations) => {
    return (user._count?.tasksAsEditor || 0) + (user._count?.tasksAsCommunity || 0);
  };

  const getWorkloadBadge = (user: AdminUserWithRelations) => {
    const count = getTaskCount(user);
    if (count === 0) return <Badge variant="outline">0</Badge>;
    if (count > 10) return <Badge variant="destructive">🔥 {count}</Badge>;
    if (count > 5) return <Badge className="bg-yellow-500 text-yellow-900">⚠️ {count}</Badge>;
    return <Badge variant="secondary">{count}</Badge>;
  };

  return (
    <>
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Avatar</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Especialidad</TableHead>
              <TableHead>Carga</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead className="text-right w-20">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No hay usuarios registrados
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <UserRowContextMenu
                  key={user.id}
                  user={user}
                  onEdit={() => handleEdit(user)}
                  onDelete={() => handleDelete(user.id, user.name)}
                >
                  <TableRow>
                    <TableCell>
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={user.image || undefined} />
                        <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.roleLegacy || "EDITOR")}>
                        {user.roleLegacy || "EDITOR"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.specialty ? (
                        <Badge variant="outline">{user.specialty}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getWorkloadBadge(user)}</TableCell>
                    <TableCell>
                      {format(new Date(user.createdAt), "dd/MM/yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEdit(user)}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(user.id, user.name)} className="text-red-600 focus:text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                </UserRowContextMenu>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Renderizado siempre, controlado por props */}
      {editingUser && (
        <UserSheet 
          user={editingUser} 
          mode="edit" 
          open={isSheetOpen} 
          onOpenChange={handleSheetChange}
          trigger={null} 
        />
      )}
    </>
  );
}
