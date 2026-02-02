"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MapPin, Users, FileText, Mic, ExternalLink, Edit, X, Video, Calendar, Send, Link as LinkIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import type { ShootWithRelations } from "@/actions/shooting-actions";

interface ShootingDetailProps {
  shooting: ShootWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onCancel: () => void;
}

export function ShootingDetail({
  shooting,
  open,
  onOpenChange,
  onEdit,
  onCancel,
}: ShootingDetailProps) {
  const { toast } = useToast();
  if (!shooting) return null;

  const getCalendarShareLink = (link?: string | null) => {
    if (!link) return null;
    try {
      const url = new URL(link);
      const eid = url.searchParams.get("eid");
      if (eid) {
        return `https://calendar.google.com/calendar/event?eid=${eid}`;
      }
      return link;
    } catch {
      return link;
    }
  };

  const calendarShareLink = getCalendarShareLink(shooting.googleEventLink);
  const startDate = new Date(shooting.startTime);
  const endDate = new Date(shooting.endTime);
  const shareText = calendarShareLink
    ? `Rodaje ${shooting.title} ${format(startDate, "EEEE, d MMM", { locale: es })} • ${format(startDate, "h:mm a", { locale: es })}–${format(endDate, "h:mm a", { locale: es })}\nVer detalles y confirmar asistencia ${calendarShareLink}`
    : null;

  const handleShareInvitation = async () => {
    if (!shareText) return;
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch (error) {
        console.warn("Share cancelado", error);
      }
    }
    await navigator.clipboard.writeText(shareText);
    toast({
      title: "Invitación copiada",
      description: "Puedes pegarla en WhatsApp, correo o donde quieras",
    });
  };

  const handleCopyLink = async () => {
    if (!calendarShareLink) return;
    await navigator.clipboard.writeText(calendarShareLink);
    toast({
      title: "Enlace copiado",
      description: "El enlace del evento se copió al portapapeles",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl mb-2">{shooting.title}</DialogTitle>
              <div className="mt-2">
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
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Fecha y Hora */}
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Fecha y Hora</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(shooting.startTime), "PPP 'a las' HH:mm", { locale: es })} - {format(new Date(shooting.endTime), "HH:mm", { locale: es })}
              </p>
            </div>
          </div>

          {/* Cliente */}
          <div className="flex items-start gap-3">
            {(shooting.client as any)?.logo && (
              <img
                src={(shooting.client as any).logo}
                alt={shooting.client.name}
                className="h-6 w-6 object-contain mt-0.5"
              />
            )}
            <div>
              <p className="text-sm font-medium mb-1">Cliente</p>
              <p className="text-sm text-muted-foreground">{shooting.client.name}</p>
            </div>
          </div>

          {/* Ubicación */}
          {shooting.address && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">Ubicación</p>
                <p className="text-sm text-muted-foreground">{shooting.address}</p>
                {shooting.mapLink && (
                  <a
                    href={shooting.mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-primary hover:underline text-sm"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ver en Maps
                  </a>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Equipo (Crew) */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium">Equipo ({shooting.crew.length})</p>
            </div>
            {shooting.crew.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay miembros asignados</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {shooting.crew.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-2 p-2 rounded-lg border bg-background"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.image || undefined} />
                      <AvatarFallback>
                        {member.name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{member.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Tareas Vinculadas */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Video className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium">Tareas a Grabar ({shooting.tasks.length})</p>
            </div>
            {shooting.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay tareas asignadas</p>
            ) : (
              <div className="space-y-2">
                {shooting.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border bg-background flex items-start justify-between"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {task.client.name}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {task.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notas */}
          {shooting.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-1">Notas</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{shooting.notes}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Archivos */}
          <div className="space-y-4">
            {shooting.scriptUrl && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium">Guión</p>
                </div>
                <a
                  href={shooting.scriptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block"
                >
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Descargar Guión
                  </Button>
                </a>
              </div>
            )}

            {shooting.audioBriefUrl && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Mic className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium">Nota de Voz</p>
                </div>
                <audio controls src={shooting.audioBriefUrl} className="w-full" />
              </div>
            )}
          </div>

          {/* Botones de Acción */}
          {shooting.status === "SCHEDULED" && (
            <>
              <Separator />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onCancel}>
                  <X className="mr-2 h-4 w-4" />
                  Cancelar Rodaje
                </Button>
                <Button onClick={onEdit}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              </div>
            </>
          )}

          {calendarShareLink && (
            <>
              <Separator />
              <div className="flex w-full gap-3">
                <Button variant="outline" onClick={handleShareInvitation} className="flex-1">
                  <Send className="mr-2 h-4 w-4" />
                  Enviar invitación
                </Button>
                <Button onClick={handleCopyLink} className="flex-1">
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Copiar enlace
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

