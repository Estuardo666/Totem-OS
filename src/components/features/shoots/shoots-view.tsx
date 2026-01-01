"use client";

import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Video, MapPin, Users, FileText, Mic, ExternalLink, Edit, X, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ShootingForm } from "./shooting-form";
import { ShootingDetail } from "./shooting-detail";
import { cancelShooting } from "@/actions/shooting-actions";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import type { ShootWithRelations } from "@/actions/shooting-actions";
import type { Client } from "@prisma/client";

interface ShootsViewProps {
  shootings: ShootWithRelations[];
  clients: Client[];
}

export function ShootsView({ shootings: initialShootings, clients }: ShootsViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedShooting, setSelectedShooting] = useState<ShootWithRelations | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingShooting, setEditingShooting] = useState<ShootWithRelations | null>(null);

  const handleNewShooting = () => {
    setEditingShooting(null);
    setIsFormOpen(true);
  };

  // Filtrar rodajes
  const filteredShootings = initialShootings.filter((shooting) => {
    if (selectedClientId !== "all" && shooting.clientId !== selectedClientId) return false;
    if (selectedStatus !== "all" && shooting.status !== selectedStatus) return false;
    return true;
  });

  // Rodajes del mes actual
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthShootings = filteredShootings.filter((shooting) => {
    const shootDate = new Date(shooting.startTime);
    return shootDate >= monthStart && shootDate <= monthEnd;
  });

  // Calendario
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

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

  return (
    <div className="space-y-6">
      {/* Botón Nuevo Rodaje */}
      <div className="flex justify-end">
        <Button onClick={handleNewShooting}>
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

      {/* Vistas */}
      <Tabs defaultValue="calendar" className="w-full">
        <TabsList>
          <TabsTrigger value="calendar">Calendario</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {/* Navegación del mes */}
              <div className="flex items-center justify-between mb-6">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-xl font-semibold">
                  {format(currentMonth, "MMMM yyyy", { locale: es })}
                </h2>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Calendario */}
              <div className="grid grid-cols-7 gap-2">
                {/* Días de la semana */}
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                    {day}
                  </div>
                ))}

                {/* Días del mes */}
                {calendarDays.map((day) => {
                  const dayShootings = monthShootings.filter((shooting) =>
                    isSameDay(new Date(shooting.startTime), day)
                  );
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-[100px] border rounded-lg p-2 ${
                        isCurrentMonth ? "bg-background" : "bg-muted/30"
                      } ${isToday ? "ring-2 ring-primary" : ""}`}
                    >
                      <div className={`text-sm mb-1 ${isCurrentMonth ? "" : "text-muted-foreground"}`}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-1">
                        {dayShootings.slice(0, 2).map((shooting) => (
                          <div
                            key={shooting.id}
                            onClick={() => handleShootingClick(shooting)}
                            className="text-xs p-1 rounded bg-primary text-primary-foreground cursor-pointer hover:opacity-80 truncate"
                            title={shooting.title}
                          >
                            {shooting.title}
                          </div>
                        ))}
                        {dayShootings.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{dayShootings.length - 2} más
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {filteredShootings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No hay rodajes que mostrar
                  </p>
                ) : (
                  filteredShootings.map((shooting) => (
                    <div
                      key={shooting.id}
                      onClick={() => handleShootingClick(shooting)}
                      className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{shooting.title}</h3>
                            <Badge
                              variant={
                                shooting.status === "COMPLETED"
                                  ? "default"
                                  : shooting.status === "CANCELED"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {shooting.status === "SCHEDULED"
                                ? "Programado"
                                : shooting.status === "COMPLETED"
                                ? "Completado"
                                : "Cancelado"}
                            </Badge>
                          </div>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Video className="h-4 w-4" />
                              {format(new Date(shooting.startTime), "PPP 'a las' HH:mm", { locale: es })}
                            </div>
                            <div className="flex items-center gap-2">
                              <span>{shooting.client.name}</span>
                            </div>
                            {shooting.address && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                {shooting.address}
                              </div>
                            )}
                            <div className="flex items-center gap-4 mt-2">
                              <div className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                <span>{shooting.crew.length} miembros</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <FileText className="h-4 w-4" />
                                <span>{shooting.tasks.length} tareas</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de detalle */}
      <ShootingDetail
        shooting={selectedShooting}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEdit={handleEdit}
        onCancel={handleCancel}
      />

      {/* Formulario */}
      <ShootingForm
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditingShooting(null);
            router.refresh();
          }
        }}
        clients={clients}
        shooting={editingShooting}
      />
    </div>
  );
}

