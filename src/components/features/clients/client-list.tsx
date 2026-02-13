"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo, useState } from "react";
import type { Client } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import {
  Bell,
  Video,
  Image as ImageIcon,
  Calendar,
  CheckCircle2,
  Clock,
  Film,
  Eye,
  Search,
  Edit
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { EditClientDialog } from "./edit-client-dialog";

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
  isAdmin: boolean;
  canEditClient?: boolean;
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

// Helper para formatear dinero
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ClientList({ clients, isAdmin, canEditClient = false }: ClientListProps) {
  const [query, setQuery] = useState("");
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredClients = useMemo(() => {
    if (!normalizedQuery) return clients;
    return clients.filter((client) =>
      client.name.toLowerCase().startsWith(normalizedQuery)
    );
  }, [clients, normalizedQuery]);

  const listIsEmpty = clients.length === 0;

  if (listIsEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed bg-card">
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
      <div className="mb-8 mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:w-96 relative">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar cliente..."
            className="pl-10 h-11 rounded-xl bg-card border shadow-sm"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Mostrando {filteredClients.length} de {clients.length} clientes
        </p>
      </div>

      {filteredClients.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center bg-card">
          <p className="text-muted-foreground">
            No encontramos clientes que comiencen con “{query}”.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filteredClients.map((client, index) => {
        const userColor = client.color || "#6366f1";
        const monthlyReels = client.monthlyReels || 0;
        const monthlyFlyers = client.monthlyFlyers || 0;
        const isEditOpen = editingClientId === client.id;
        
        const clientCard = (
          <div
            className={`group h-full transition-all duration-200 rounded-2xl p-5 border bg-card shadow-sm hover:shadow-md ${canEditClient ? 'cursor-pointer' : 'cursor-not-allowed'} animate-fade-in`}
            style={{
              animationDelay: `${Math.min(index, 6) * 50}ms`,
            }}
          >
            
            {/* Barra de color superior */}
            <div 
              className="h-1 -mx-5 -mt-5 mb-4 rounded-t-2xl"
              style={{ backgroundColor: userColor }}
            />
            
            {/* Logo iOS-style */}
            <div className="mb-4">
              {client.logo ? (
                <div 
                  className="relative h-14 w-14 rounded-xl overflow-hidden flex items-center justify-center ring-2 ring-border/30 shadow-sm"
                  style={{ backgroundColor: hexToRgba(userColor, 0.08) }}
                >
                  <Image
                    src={client.logo}
                    alt={client.name}
                    fill
                    className="object-cover"
                    priority={index < 4}
                    sizes="56px"
                  />
                </div>
              ) : (
                <div 
                  className="h-14 w-14 rounded-xl flex items-center justify-center font-bold text-xl ring-2 ring-border/30 shadow-sm"
                  style={{ 
                    backgroundColor: hexToRgba(userColor, 0.15),
                    color: userColor 
                  }}
                >
                  {client.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Título y Estado */}
            <div className="mb-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="text-xl font-bold leading-tight line-clamp-1">{client.name}</h2>
                <div className="flex items-center gap-1">
                  {client.hasPendingFeedback && (
                    <div className="relative shrink-0">
                      <Bell className="h-4 w-4 text-orange-500" />
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-orange-500 rounded-full animate-pulse" />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    client.status === "ACTIVE"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : client.status === "PAUSED"
                        ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                        : client.status === "DEBT"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {client.status === "ACTIVE"
                    ? "Activo"
                    : client.status === "PAUSED"
                      ? "Pausado"
                      : client.status === "INACTIVE"
                        ? "Inactivo"
                        : "En Deuda"}
                </Badge>
                
                {/* Mostrar fecha de cobro si existe tarifa mensual */}
                {client.monthlyRate && client.monthlyRate > 0 && client.paymentDay && (
                  <>
                    <Badge 
                      variant="outline" 
                      className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                    >
                      Cobro: día {client.paymentDay}
                    </Badge>
                    {isAdmin && (
                      <Badge 
                        variant="outline" 
                        className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                      >
                        {formatCurrency(client.monthlyRate)}
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Métricas */}
            <div className="space-y-2.5">
              {/* Reels y Flyers */}
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3 pt-2.5 mt-2 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Publicadas</p>
                    <p className="text-sm font-semibold">{client.publishedTasksCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Pendientes</p>
                    <p className="text-sm font-semibold">{client.pendingTasksCount}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

        return (
          <div key={client.id} className="relative">
            {canEditClient ? (
              <Link href={`/clients/${client.id}`}>
                <div className="pointer-events-auto">
                  {clientCard}
                </div>
              </Link>
            ) : (
              clientCard
            )}
            {isAdmin && (
              <div 
                className="absolute top-4 right-4 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingClientId(client.id)}
                  className="h-6 w-6 p-0"
                  title="Editar cliente"
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <EditClientDialog
              client={client}
              open={isEditOpen}
              onOpenChange={(open) => setEditingClientId(open ? client.id : null)}
              users={[]}
            />
          </div>
        );
      })}
      </div>
      )}
    </TooltipProvider>
  );
}

