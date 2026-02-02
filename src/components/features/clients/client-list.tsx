"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Client } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import {
  Bell,
  Video,
  Image as ImageIcon,
  Calendar,
  CheckCircle2,
  Clock,
  Film,
  Eye
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSession } from "next-auth/react";

interface ClientListProps {
  clients: Array<Client & {
    hasPendingFeedback?: boolean;
    reelsCompleted: number;
    flyersCompleted: number;
    publishedTasksCount: number;
    pendingTasksCount: number;
    nextShootDate: Date | null;
    lastPostDate: Date | null;
    lastPostTask?: { title: string; postCopy?: string };
    nextShootDetails?: { title: string; address?: string };
  }>;
}

// Helper para convertir hex a rgba con opacidad
function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Función para formatear fechas en español natural
function formatDateNatural(date: Date): string {
  return format(date, "d 'de' MMMM 'a las' HH:mm", { locale: es });
}

export function ClientList({ clients }: ClientListProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-dashed">
        <p className="text-muted-foreground text-center text-lg">
          No hay clientes aún
        </p>
        <p className="text-muted-foreground mt-2 text-center text-sm">
          Crea tu primer cliente para comenzar
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {clients.map((client, index) => {
        const userColor = client.color || "#000000";
        const monthlyReels = client.monthlyReels || 0;
        const monthlyFlyers = client.monthlyFlyers || 0;
        
        const clientCard = (
          <div
            className={`h-full transition-all rounded-lg p-6 border-none ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`}
            style={{
              backgroundColor: hexToRgba(userColor, 0.05),
            }}
            onMouseEnter={(e) => {
              if (isAdmin) {
                e.currentTarget.style.backgroundColor = hexToRgba(userColor, 0.1);
              }
            }}
            onMouseLeave={(e) => {
              if (isAdmin) {
                e.currentTarget.style.backgroundColor = hexToRgba(userColor, 0.05);
              }
            }}
          >
            
            {/* Logo */}
            <div className="mb-4">
              {client.logo ? (
                <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center">
                  <Image
                    src={client.logo}
                    alt={client.name}
                    fill
                    className="object-contain p-2"
                    priority={index < 4}
                    sizes="64px"
                  />
                </div>
              ) : (
                <div 
                  className="h-16 w-16 rounded-lg flex items-center justify-center text-white font-bold text-2xl"
                  style={{ backgroundColor: hexToRgba(userColor, 0.2) }}
                >
                  {client.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Título y Estado */}
            <div className="mb-6">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="text-2xl font-bold leading-tight">{client.name}</h2>
                {client.hasPendingFeedback && (
                  <div className="relative shrink-0 mt-1">
                    <Bell className="h-5 w-5 text-red-600" />
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-600 rounded-full border-2 border-white"></span>
                  </div>
                )}
              </div>
              <Badge
                variant={client.status === "ACTIVE" ? "default" : "secondary"}
                className={
                  client.status === "ACTIVE"
                    ? "bg-green-500 hover:bg-green-600 text-white border-transparent"
                    : client.status === "INACTIVE"
                      ? "bg-slate-400 hover:bg-slate-500 text-white border-transparent"
                      : "bg-gray-500 hover:bg-gray-600 text-white border-transparent"
                }
              >
                {client.status === "ACTIVE"
                  ? "Activo"
                  : client.status === "PAUSED"
                    ? "Pausado"
                    : client.status === "INACTIVE"
                      ? "Inactivo"
                      : "En Deuda"}
              </Badge>
            </div>

            {/* Métricas */}
            <div className="space-y-3">
              {/* Reels y Flyers */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Reels</p>
                    <p className="text-sm font-bold">
                      {client.reelsCompleted}/{monthlyReels}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Flyers</p>
                    <p className="text-sm font-bold">
                      {client.flyersCompleted}/{monthlyFlyers}
                    </p>
                  </div>
                </div>
              </div>

              {/* Último Posteo */}
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Último posteo</p>
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium">
                      {client.lastPostDate
                        ? formatDateNatural(new Date(client.lastPostDate))
                        : "Nunca"}
                    </p>
                    {client.lastPostDate && client.lastPostTask && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Eye className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-2">
                            <p className="font-semibold">{client.lastPostTask.title}</p>
                            {client.lastPostTask.postCopy && (
                              <p className="text-xs text-muted-foreground line-clamp-3">
                                {client.lastPostTask.postCopy}
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>

              {/* Próximo Rodaje */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Próximo rodaje</p>
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium">
                      {client.nextShootDate
                        ? formatDateNatural(new Date(client.nextShootDate))
                        : "No programado"}
                    </p>
                    {client.nextShootDate && client.nextShootDetails && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Eye className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-2">
                            <p className="font-semibold">{client.nextShootDetails.title}</p>
                            {client.nextShootDetails.address && (
                              <p className="text-xs text-muted-foreground">
                                📍 {client.nextShootDetails.address}
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>

              {/* Tareas Publicadas y Pendientes */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Publicadas</p>
                    <p className="text-sm font-bold">{client.publishedTasksCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Pendientes</p>
                    <p className="text-sm font-bold">{client.pendingTasksCount}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

        return isAdmin ? (
          <Link key={client.id} href={`/clients/${client.id}`}>
            {clientCard}
          </Link>
        ) : (
          <div key={client.id}>
            {clientCard}
          </div>
        );
      })}
      </div>
    </TooltipProvider>
  );
}

