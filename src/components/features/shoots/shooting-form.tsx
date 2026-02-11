"use client";

import { useState, useEffect, useTransition, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Loader2, X, Calendar, MapPin, Users, FileText, ChevronDown, ChevronUp, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { UploadButton } from "@/utils/uploadthing";
import { GooglePlacesAutocomplete, type PlaceDetails } from "@/components/ui/google-places-autocomplete";
import { useToast } from "@/components/ui/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { createShooting, updateShooting, type CreateShootingInput, type UpdateShootingInput } from "@/actions/shooting-actions";
import { getTasks } from "@/actions/content-actions";
import { getUsers } from "@/actions/user.actions";
import type { Client, User, ContentTask } from "@prisma/client";
import type { ShootWithRelations } from "@/lib/shooting-service";

interface ShootingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  shooting?: ShootWithRelations | null;
  onCreated?: (shooting: ShootWithRelations) => void;
  initialTitle?: string;
  initialNotes?: string;
  initialDate?: Date;
  initialClientId?: string;
  initialStartTime?: string;
  initialEndTime?: string;
}

export function ShootingForm({
  open,
  onOpenChange,
  clients,
  shooting,
  onCreated,
  initialTitle,
  initialNotes,
  initialDate,
  initialClientId,
  initialStartTime,
  initialEndTime,
}: ShootingFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  
  const [title, setTitle] = useState(initialTitle ?? "");
  const [date, setDate] = useState(initialDate ? format(initialDate, "yyyy-MM-dd") : "");
  const [startTime, setStartTime] = useState(initialStartTime ?? "");
  const [endTime, setEndTime] = useState(initialEndTime ?? "");
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [address, setAddress] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [scriptUrl, setScriptUrl] = useState("");
  const [audioBriefUrl, setAudioBriefUrl] = useState("");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [clientSearch, setClientSearch] = useState("");
  const debouncedClientSearch = useDebounce(clientSearch, 300);
  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [createCalendarEvent, setCreateCalendarEvent] = useState(true);
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  
  const [users, setUsers] = useState<User[]>([]);
  const [availableTasks, setAvailableTasks] = useState<ContentTask[]>([]);

  const defaultCrewIds = useMemo(() => {
    const paty = users.find((u) => u.email === "totemcisnemedia@gmail.com");
    const stuart = users.find((u) => u.email === "estuarlito@gmail.com");
    return [paty?.id, stuart?.id].filter(Boolean) as string[];
  }, [users]);

  const normalizeText = useCallback((text: string) =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, ""),
    []
  );

  const sortedClients = useMemo(() => 
    [...clients].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })),
    [clients]
  );
  
  const filteredClients = useMemo(() => {
    const search = normalizeText(debouncedClientSearch).trim();
    if (!search) return sortedClients;
    return sortedClients.filter((client) => 
      normalizeText(client.name).startsWith(search)
    );
  }, [sortedClients, debouncedClientSearch, normalizeText]);

  // Cargar usuarios al montar
  useEffect(() => {
    getUsers().then((result) => {
      if (result.success && result.data) {
        setUsers(result.data);
        // Preseleccionar Paty y Stuart para nuevos rodajes
        if (!shooting) {
          const paty = result.data.find(u => u.email === "totemcisnemedia@gmail.com");
          const stuart = result.data.find(u => u.email === "estuarlito@gmail.com");
          const preselectedIds = [paty?.id, stuart?.id].filter(Boolean) as string[];
          setSelectedCrewIds(preselectedIds);
        }
      }
    });

    // Verificar estado de Google Calendar con AbortController
    const controller = new AbortController();
    
    fetch('/api/google-calendar/status', { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (open) {  // Solo actualizar si aún está abierto
          setIsCalendarConnected(data.connected);
        }
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.error('Error verificando Google Calendar:', error);
        }
      });

    return () => controller.abort();
  }, [open]);

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

  // Inicializar formulario cuando se abre (modo nuevo) con defaults de voz
  useEffect(() => {
    if (!shooting && open) {
      setTitle(initialTitle ?? "");
      setDate(initialDate ? format(initialDate, "yyyy-MM-dd") : "");
      setClientId(initialClientId ?? "");
      setNotes(initialNotes ?? "");
      setStartTime(initialStartTime ?? "");
      setEndTime(initialEndTime ?? "");
    }
  }, [open, shooting, initialTitle, initialDate, initialClientId, initialNotes, initialStartTime, initialEndTime]);

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
    }
  }, [shooting, open, defaultCrewIds]);

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

  const handleStartTimeChange = (time: string) => {
    setStartTime(time);
    // Auto-fill end time as start time + 1 hour
    if (time) {
      const [hours, minutes] = time.split(":").map(Number);
      const endHour = (hours + 1) % 24;
      const endTimeStr = `${endHour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      setEndTime(endTimeStr);
    } else {
      setEndTime("");
    }
  };

  const handleAddressSelect = (address: string, place: PlaceDetails) => {
    setAddress(address);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[93vw] sm:w-[62vw] md:w-[56vw] lg:w-[48vw] xl:w-[42vw] max-w-3xl max-h-[90vh] gap-4 border border-black/5 dark:border-white/10 bg-white dark:bg-background/5 dark:backdrop-blur-xl rounded-[2.5rem] shadow-2xl duration-200 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 overflow-hidden p-6 transition-[height,max-height] duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[height]">
        <DialogHeader className="pl-12 pr-4 pt-12 pb-3 space-y-1 text-left md:text-center md:px-10 md:pt-10">
          <DialogTitle className="text-2xl md:text-3xl font-semibold leading-tight">
            {shooting ? "Editar Rodaje" : "Nuevo Rodaje"}
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            {shooting ? "Actualiza la información del rodaje" : "Crea un nuevo rodaje y asigna equipo y tareas"}
          </DialogDescription>
        </DialogHeader>

        <div
          ref={scrollAreaRef}
          className="px-4 pb-4 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)] transition-[height,max-height] duration-600 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[height]
          scrollbar-track-transparent scrollbar-thumb-transparent hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40 hover:[&::-webkit-scrollbar-thumb]:transition hover:[&::-webkit-scrollbar-thumb]:duration-500 md:scrollbar-thin"
          style={{ scrollbarGutter: "stable" }}
        >
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
                className="text-2xl font-medium border-0 border-b-2 border-input rounded-none px-0 pb-2 bg-transparent focus:border-primary"
                style={{ fontSize: "1.5rem", fontWeight: "500" }}
              />
            </div>

            <div>
              <Label htmlFor="client" className="flex items-center gap-2 pb-3">
                <UserIcon className="h-4 w-4" />
                Cliente *
              </Label>
              <Select value={clientId} onValueChange={setClientId} disabled={isPending}>
                <SelectTrigger id="client">
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-3 pt-3 pb-2" onKeyDown={(e) => e.stopPropagation()}>
                    <Input
                      placeholder="Buscar cliente"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {filteredClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={(client as any).logo || undefined} alt={client.name} />
                          <AvatarFallback className="bg-primary text-white text-xs font-medium">
                            {client.name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
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
            <div className="space-y-4">
              <div>
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={isPending}
                  className="w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Hora de Inicio *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
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

            {/* Botones 50/50 */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="w-full"
              >
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isPending} className="w-full">
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

          {/* Más opciones - Acordion */}
          <Collapsible open={moreOptionsOpen} onOpenChange={setMoreOptionsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-between font-bold bg-muted hover:bg-muted/80"
              >
                <span>Más opciones</span>
                {moreOptionsOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent
              className="mt-4 overflow-hidden transition-all duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)] data-[state=closed]:max-h-0 data-[state=closed]:opacity-0 data-[state=open]:max-h-[3000px] data-[state=open]:opacity-100"
            >
              <div className="space-y-6">
                {/* Ubicación - Primero */}
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
                  {/* Campo oculto para Google Maps link */}
                  <input
                    type="hidden"
                    id="mapLink"
                    value={mapLink}
                    onChange={(e) => setMapLink(e.target.value)}
                  />
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
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DialogContent>
    </Dialog>
  );
}
