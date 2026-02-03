"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Loader2, X, Calendar, MapPin, Users, FileText, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UploadButton } from "@/utils/uploadthing";
import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";
import { AudioRecorder } from "@/components/ui/audio-recorder";
import { useToast } from "@/components/ui/use-toast";
import { createShooting, updateShooting, type CreateShootingInput, type UpdateShootingInput } from "@/actions/shooting-actions";
import { getTasks } from "@/actions/content-actions";
import { getUsers } from "@/actions/user.actions";
import type { Client, User, ContentTask } from "@prisma/client";
import type { ShootWithRelations } from "@/actions/shooting-actions";

interface ShootingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  shooting?: ShootWithRelations | null;
  onCreated?: (shooting: ShootWithRelations) => void;
}

export function ShootingForm({ open, onOpenChange, clients, shooting, onCreated }: ShootingFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [address, setAddress] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [scriptUrl, setScriptUrl] = useState("");
  const [audioBriefUrl, setAudioBriefUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [createCalendarEvent, setCreateCalendarEvent] = useState(true);
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  
  const [users, setUsers] = useState<User[]>([]);
  const [availableTasks, setAvailableTasks] = useState<ContentTask[]>([]);

  // Cargar usuarios al montar
  useEffect(() => {
    getUsers().then((result) => {
      if (result.success && result.data) {
        setUsers(result.data);
      }
    });

    // Verificar estado de Google Calendar
    fetch('/api/google-calendar/status')
      .then(res => res.json())
      .then(data => {
        setIsCalendarConnected(data.connected);
      })
      .catch(error => {
        console.error('Error verificando Google Calendar:', error);
      });
  }, []);

  // Cargar tareas cuando se selecciona un cliente
  useEffect(() => {
    if (clientId) {
      getTasks().then((result) => {
        if (result.success && result.data) {
          // Filtrar tareas activas del cliente seleccionado
          const activeStatuses = ["IDEA", "RECORDED", "EDITING", "REVIEW_INTERNAL", "REVIEW_CLIENT", "CLIENT_APPROVED", "APPROVED"];
          const clientTasks = result.data.filter(
            (task) => task.clientId === clientId && activeStatuses.includes(task.status)
          );
          setAvailableTasks(clientTasks);
        }
      });
    } else {
      setAvailableTasks([]);
    }
  }, [clientId]);

  // Inicializar formulario cuando se abre o cambia el shooting
  useEffect(() => {
    if (shooting) {
      setTitle(shooting.title);
      setDate(format(new Date(shooting.startTime), "yyyy-MM-dd"));
      setStartTime(format(new Date(shooting.startTime), "HH:mm"));
      setEndTime(format(new Date(shooting.endTime), "HH:mm"));
      setClientId(shooting.clientId);
      setAddress(shooting.address || "");
      setMapLink(shooting.mapLink || "");
      setScriptUrl(shooting.scriptUrl || "");
      setAudioBriefUrl(shooting.audioBriefUrl || "");
      setNotes(shooting.notes || "");
      setSelectedCrewIds(shooting.crew.map((u) => u.id));
      setSelectedTaskIds(shooting.tasks.map((t) => t.id));
      setCreateCalendarEvent(Boolean(shooting.googleEventId));
    } else {
      // Reset form
      setTitle("");
      setDate("");
      setStartTime("");
      setEndTime("");
      setClientId("");
      setAddress("");
      setMapLink("");
      setScriptUrl("");
      setAudioBriefUrl("");
      setNotes("");
      setSelectedCrewIds([]);
      setSelectedTaskIds([]);
      setCreateCalendarEvent(true);
    }
  }, [shooting, open]);

  const handleSubmit = () => {
    if (!title || !date || !startTime || !endTime || !clientId) {
      toast({
        variant: "destructive",
        title: "Campos requeridos",
        description: "Por favor completa todos los campos obligatorios",
      });
      return;
    }

    // Combinar fecha y hora
    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(`${date}T${endTime}`);

    // Validar que endTime sea posterior a startTime
    if (endDateTime <= startDateTime) {
      toast({
        variant: "destructive",
        title: "Error de horario",
        description: "La hora de finalización debe ser posterior a la hora de inicio",
      });
      return;
    }

    startTransition(async () => {
      try {
        if (shooting) {
          // Actualizar
          const updateData: UpdateShootingInput = {
            id: shooting.id,
            title,
            startTime: startDateTime,
            endTime: endDateTime,
            address: address || undefined,
            mapLink: mapLink || undefined,
            scriptUrl: scriptUrl || undefined,
            audioBriefUrl: audioBriefUrl || undefined,
            notes: notes || undefined,
            clientId,
            crewIds: selectedCrewIds,
            taskIds: selectedTaskIds,
            createCalendarEvent,
          };

          const result = await updateShooting(updateData);
          if (result.success) {
            toast({
              title: "Rodaje actualizado",
              description: "El rodaje se ha actualizado correctamente",
            });
            const calendarError = (result as { calendarError?: string | null }).calendarError;
            if (createCalendarEvent && calendarError) {
              toast({
                variant: "destructive",
                title: "Google Calendar",
                description: calendarError,
              });
            }
            onOpenChange(false);
            router.refresh();
          } else {
            toast({
              variant: "destructive",
              title: "Error",
              description: result.error || "No se pudo actualizar el rodaje",
            });
          }
        } else {
          // Crear
          const createData: CreateShootingInput = {
            title,
            startTime: startDateTime,
            endTime: endDateTime,
            address: address || undefined,
            mapLink: mapLink || undefined,
            scriptUrl: scriptUrl || undefined,
            audioBriefUrl: audioBriefUrl || undefined,
            notes: notes || undefined,
            clientId,
            crewIds: selectedCrewIds,
            taskIds: selectedTaskIds,
            createCalendarEvent,
          };

          const result = await createShooting(createData);
          if (result.success) {
            toast({
              title: "Rodaje creado",
              description: "El rodaje se ha creado correctamente",
            });
            const calendarError = (result as { calendarError?: string | null }).calendarError;
            if (createCalendarEvent && calendarError) {
              toast({
                variant: "destructive",
                title: "Google Calendar",
                description: calendarError,
              });
            }
            onOpenChange(false);
            if (result.data) {
              onCreated?.(result.data as ShootWithRelations);
            }
            router.refresh();
          } else {
            toast({
              variant: "destructive",
              title: "Error",
              description: result.error || "No se pudo crear el rodaje",
            });
          }
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Ocurrió un error inesperado",
        });
      }
    });
  };

  const toggleCrew = (userId: string) => {
    setSelectedCrewIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleAddressSelect = (address: string, place: PlaceDetails) => {
    setAddress(address);
    // Generar Google Maps link si hay URL disponible
    if (place.url) {
      setMapLink(place.url);
    } else if (place.geometry) {
      // Generar link basado en coordenadas
      const { lat, lng } = place.geometry.location;
      const latVal = typeof lat === "function" ? lat() : lat;
      const lngVal = typeof lng === "function" ? lng() : lng;
      setMapLink(`https://maps.google.com/?q=${latVal},${lngVal}`);
    }
  };

  const handleAddressClear = () => {
    setAddress("");
    setMapLink("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{shooting ? "Editar Rodaje" : "Nuevo Rodaje"}</SheetTitle>
          <SheetDescription>
            {shooting
              ? "Actualiza la información del rodaje"
              : "Crea un nuevo rodaje y asigna equipo y tareas"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Título y Cliente */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Rodaje Producto X - Enero 2025"
                disabled={isPending}
              />
            </div>

            <div>
              <Label htmlFor="client">Cliente *</Label>
              <Select value={clientId} onValueChange={setClientId} disabled={isPending}>
                <SelectTrigger id="client">
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        {(client as any).logo ? (
                          <img
                            src={(client as any).logo}
                            alt={client.name}
                            className="h-4 w-4 object-contain"
                          />
                        ) : (
                          <div 
                            className="h-4 w-4 rounded flex items-center justify-center text-white text-xs font-medium"
                            style={{ backgroundColor: client.color || "#000000" }}
                          >
                            {client.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span>{client.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fecha y Hora */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Label>Fecha y Hora *</Label>
            </div>
            <div>
              <Label htmlFor="date">Fecha</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isPending}
                className="mb-4"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Hora de Inicio *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div>
                <Label htmlFor="endTime">Hora de Fin *</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-4">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales sobre el rodaje..."
              disabled={isPending}
              rows={3}
            />
          </div>

          {/* Ubicación */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <Label>Ubicación</Label>
            </div>
            <div>
              <Label htmlFor="address">Dirección</Label>
              <GooglePlacesAutocomplete
                onAddressSelect={handleAddressSelect}
                onClear={handleAddressClear}
                onInputChange={setAddress}
                placeholder="Buscar dirección..."
                value={address}
                disabled={false}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="mapLink">Link de Google Maps</Label>
              <Input
                id="mapLink"
                type="url"
                value={mapLink}
                onChange={(e) => setMapLink(e.target.value)}
                placeholder="https://maps.google.com/..."
                disabled={isPending}
              />
            </div>
          </div>

          {/* Google Calendar */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Label>Google Calendar</Label>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="createCalendarEvent"
                  checked={createCalendarEvent}
                  onCheckedChange={(checked) => setCreateCalendarEvent(checked as boolean)}
                  disabled={!isCalendarConnected || isPending}
                />
                <Label htmlFor="createCalendarEvent" className="text-sm">
                  Crear evento en Google Calendar
                </Label>
              </div>
              {!isCalendarConnected ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/admin/settings")}
                  disabled={isPending}
                >
                  Ir a configuración
                </Button>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  Conectado
                </Badge>
              )}
            </div>
            {!isCalendarConnected && (
              <p className="text-xs text-muted-foreground">
                Google Calendar no está conectado. Ve a configuración para conectarlo y habilitar la creación automática
                de eventos.
              </p>
            )}
          </div>

          {/* Equipo (Crew) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Label>Equipo (Crew)</Label>
            </div>
            <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground">Cargando usuarios...</p>
              ) : (
                <div className="space-y-2">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-2 rounded hover:bg-accent cursor-pointer"
                      onClick={() => toggleCrew(user.id)}
                    >
                      <Checkbox
                        checked={selectedCrewIds.includes(user.id)}
                        onCheckedChange={() => toggleCrew(user.id)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.image || undefined} />
                        <AvatarFallback>
                          {user.name
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{user.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tareas a Grabar */}
          <div className="space-y-4">
            <Label>Tareas a Grabar</Label>
            {!clientId ? (
              <p className="text-sm text-muted-foreground">
                Selecciona un cliente para ver sus tareas activas
              </p>
            ) : availableTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay tareas activas para este cliente
              </p>
            ) : (
              <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                <div className="space-y-2">
                  {availableTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-2 rounded hover:bg-accent cursor-pointer"
                      onClick={() => toggleTask(task.id)}
                    >
                      <Checkbox
                        checked={selectedTaskIds.includes(task.id)}
                        onCheckedChange={() => toggleTask(task.id)}
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium">{task.title}</span>
                        <Badge variant="outline" className="ml-2">
                          {task.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Archivos */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <Label>Guiones</Label>
            </div>
            {scriptUrl ? (
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <a
                    href={scriptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    Ver guión
                  </a>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setScriptUrl("")}
                  disabled={isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <UploadButton
                endpoint="brandAsset"
                onClientUploadComplete={(res: Array<{ url?: string; ufsUrl?: string }>) => {
                  if (res && res[0]) {
                    const url = res[0].ufsUrl || res[0].url;
                    if (url) {
                      setScriptUrl(url);
                      toast({
                        title: "Guión subido",
                        description: "El archivo se ha subido correctamente",
                      });
                    }
                  }
                }}
                onUploadError={(error: Error) => {
                  toast({
                    variant: "destructive",
                    title: "Error al subir",
                    description: error.message,
                  });
                }}
              />
            )}

            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-muted-foreground" />
              <Label>Nota de Voz</Label>
            </div>
            {audioBriefUrl ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <audio controls src={audioBriefUrl} className="flex-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setAudioBriefUrl("")}
                    disabled={isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <AudioRecorder
                onUploadComplete={(url) => {
                  setAudioBriefUrl(url);
                  toast({
                    title: "Nota de voz guardada",
                    description: "La nota de voz se ha agregado al rodaje",
                  });
                }}
                disabled={isPending}
              />
            )}
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {shooting ? "Actualizando..." : "Creando..."}
                </>
              ) : (
                shooting ? "Actualizar" : "Crear"
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

