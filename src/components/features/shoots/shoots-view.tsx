"use client";

import { useEffect, useState } from "react";
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
import { cancelShooting, deleteShooting } from "@/actions/shooting-actions";
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
  
  // Prefilled values for new shooting from calendar click
  const [prefilledDate, setPrefilledDate] = useState<Date | undefined>();
  const [prefilledStartTime, setPrefilledStartTime] = useState<string | undefined>();
  const [prefilledEndTime, setPrefilledEndTime] = useState<string | undefined>();

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
  const filteredShootings = initialShootings.filter((shooting) => {
    if (selectedClientId !== "all" && shooting.clientId !== selectedClientId) return false;
    if (selectedStatus !== "all" && shooting.status !== selectedStatus) return false;
    return true;
  });

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

      {/* Calendario estilo Google Calendar */}
      <ShootsCalendar
        shootings={filteredShootings}
        onShootingClick={handleShootingClick}
        onCreateClick={handleCreateFromCalendar}
      />

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

