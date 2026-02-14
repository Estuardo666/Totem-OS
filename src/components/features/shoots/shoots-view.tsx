"use client";

import { useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShootingForm } from "./shooting-form";
import { ShootingDetail } from "./shooting-detail";
import { ShootsCalendar } from "./shoots-calendar";
import { Pagination } from "@/components/ui/pagination-simple";
import { 
  cancelShooting, 
  deleteShooting, 
  duplicateShooting, 
  changeShootingStatus 
} from "@/actions/shooting-actions";
import { useToast } from "@/components/ui/use-toast";
import { useRouter, useSearchParams } from "next/navigation";
import type { ShootWithRelations } from "@/lib/shooting-service";
import type { Client } from "@prisma/client";

interface ShootsViewProps {
  shootings: ShootWithRelations[];
  clients: Client[];
}

export function ShootsView({ shootings: initialShootings, clients }: ShootsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedShooting, setSelectedShooting] = useState<ShootWithRelations | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingShooting, setEditingShooting] = useState<ShootWithRelations | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Prefilled values for new shooting from calendar click
  const [prefilledDate, setPrefilledDate] = useState<Date | undefined>();
  const [prefilledStartTime, setPrefilledStartTime] = useState<string | undefined>();
  const [prefilledEndTime, setPrefilledEndTime] = useState<string | undefined>();

  // Paginación: 25 rodajes por página
  const ITEMS_PER_PAGE = 25;

  useEffect(() => {
    if (searchParams?.get("new") === "1") {
      setEditingShooting(null);
      setIsFormOpen(true);
    }
  }, [searchParams]);

  const handleCreated = (shooting: ShootWithRelations) => {
    setSelectedShooting(shooting);
    setIsDetailOpen(true);
  };

  const handleNewShooting = () => {
    // Clear prefilled values when clicking "Nuevo Rodaje" button
    setPrefilledDate(undefined);
    setPrefilledStartTime(undefined);
    setPrefilledEndTime(undefined);
    setEditingShooting(null);
    setIsFormOpen(true);
  };

  const handleCreateFromCalendar = (date: Date, startTime?: string, endTime?: string) => {
    setPrefilledDate(date);
    setPrefilledStartTime(startTime);
    setPrefilledEndTime(endTime);
    setEditingShooting(null);
    setIsFormOpen(true);
  };

  // Filtrar rodajes
  const filteredShootings = useMemo(() => {
    return initialShootings.filter((shooting) => {
      if (selectedClientId !== "all" && shooting.clientId !== selectedClientId) return false;
      if (selectedStatus !== "all" && shooting.status !== selectedStatus) return false;
      return true;
    });
  }, [initialShootings, selectedClientId, selectedStatus]);

  // Calcular paginación
  const totalPages = Math.ceil(filteredShootings.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const paginatedShootings = useMemo(() => {
    return filteredShootings.slice(startIdx, endIdx);
  }, [filteredShootings, startIdx, endIdx]);

  // Resetear página cuando cambian filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClientId, selectedStatus]);

  const handleShootingClick = (shooting: ShootWithRelations) => {
    setSelectedShooting(shooting);
    setIsDetailOpen(true);
  };

  const handleEdit = () => {
    if (selectedShooting) {
      setEditingShooting(selectedShooting);
      setIsDetailOpen(false);
      setIsFormOpen(true);
    }
  };

  const handleCancel = async () => {
    if (selectedShooting) {
      const result = await cancelShooting(selectedShooting.id);
      if (result.success) {
        toast({
          title: "Rodaje cancelado",
          description: "El rodaje se ha cancelado correctamente",
        });
        setIsDetailOpen(false);
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo cancelar el rodaje",
        });
      }
    }
  };

  const handleDelete = async () => {
    if (selectedShooting) {
      const result = await deleteShooting(selectedShooting.id);
      if (result.success) {
        toast({
          title: "Rodaje eliminado",
          description: "El rodaje se ha eliminado correctamente",
        });
        setIsDetailOpen(false);
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "No se pudo eliminar el rodaje",
        });
      }
    }
  };

  const handleDuplicate = async (shooting: ShootWithRelations, newDate?: Date) => {
    const result = await duplicateShooting(shooting.id, newDate);
    if (result.success) {
      toast({
        title: "Rodaje duplicado",
        description: "El rodaje se ha duplicado correctamente",
      });
      router.refresh();
      // Abrir el nuevo rodaje en detalle
      if (result.data) {
        setSelectedShooting(result.data);
        setIsDetailOpen(true);
      }
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error || "No se pudo duplicar el rodaje",
      });
    }
  };

  const handleQuickStatusChange = async (shooting: ShootWithRelations, status: "SCHEDULED" | "COMPLETED" | "CANCELED") => {
    const result = await changeShootingStatus(shooting.id, status);
    if (result.success) {
      const statusLabels = {
        SCHEDULED: "Programado",
        COMPLETED: "Completado",
        CANCELED: "Cancelado",
      };
      toast({
        title: "Estado actualizado",
        description: `El rodaje ahora está ${statusLabels[status]}`,
      });
      router.refresh();
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error || "No se pudo cambiar el estado",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Botón Nuevo Rodaje */}
      <div className="flex justify-end">
        <Button onClick={handleNewShooting} className="w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Rodaje
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-4">
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Todos los clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="SCHEDULED">Programado</SelectItem>
            <SelectItem value="COMPLETED">Completado</SelectItem>
            <SelectItem value="CANCELED">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Información de paginación */}
      {filteredShootings.length > 0 && (
        <div className="text-sm text-muted-foreground px-2">
          Mostrando {startIdx + 1} a {Math.min(endIdx, filteredShootings.length)} de {filteredShootings.length} rodajes
        </div>
      )}

      {/* Calendario estilo Google Calendar */}
      {paginatedShootings.length > 0 ? (
        <ShootsCalendar
          shootings={paginatedShootings}
          onShootingClick={handleShootingClick}
          onCreateClick={handleCreateFromCalendar}
          onEditShooting={(shooting) => {
            setEditingShooting(shooting);
            setIsFormOpen(true);
          }}
          onDuplicateShooting={handleDuplicate}
          onQuickStatusChange={handleQuickStatusChange}
          onDeleteShooting={async (shooting) => {
            setSelectedShooting(shooting);
            await handleDelete();
          }}
        />
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          No hay rodajes programados
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          className="justify-center"
        />
      )}

      {/* Dialog de detalle */}
      <ShootingDetail
        shooting={selectedShooting}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEdit={handleEdit}
        onCancel={handleCancel}
        onDelete={handleDelete}
      />

      {/* Formulario */}
      <ShootingForm
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditingShooting(null);
            // Clear prefilled values when closing
            setPrefilledDate(undefined);
            setPrefilledStartTime(undefined);
            setPrefilledEndTime(undefined);
            router.refresh();
          }
        }}
        clients={clients}
        shooting={editingShooting}
        onCreated={handleCreated}
        initialDate={prefilledDate}
        initialStartTime={prefilledStartTime}
        initialEndTime={prefilledEndTime}
      />
    </div>
  );
}

