"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2, MoreHorizontal, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteSpecialty } from "@/actions/admin/specialty-actions";
import type { Specialty } from "@prisma/client";

interface SpecialtyDataTableProps {
  specialties: Specialty[];
}

export function SpecialtyDataTable({ specialties }: SpecialtyDataTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de eliminar la especialidad "${name}"?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const result = await deleteSpecialty(id);
      if (result.success) {
        toast({
          title: "Especialidad eliminada",
          description: `La especialidad "${name}" ha sido eliminada.`,
        });
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Error al eliminar",
          description: result.error || "No se pudo eliminar la especialidad",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ocurrió un error inesperado",
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (specialties.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay especialidades configuradas. Crea una nueva para comenzar.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Usuarios Asignados</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {specialties.map((specialty) => (
            <TableRow key={specialty.id}>
              <TableCell className="font-medium">{specialty.name}</TableCell>
              <TableCell>
                {/* Nota: En este nivel no tenemos el count, podríamos pasarlo si fuera necesario */}
                <span className="text-muted-foreground">-</span>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleDelete(specialty.id, specialty.name)}
                      disabled={deletingId === specialty.id}
                      className="text-red-600 focus:text-red-600"
                    >
                      {deletingId === specialty.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

