"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo, useState } from "react";
import type { Client, User } from "@prisma/client";
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
  Edit,
  LayoutGrid,
  Rows3,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { EditClientDialog } from "./edit-client-dialog";
import { ClientCardContextMenu } from "./client-card-context-menu";

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
  users: User[];
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

export function ClientList({ clients, isAdmin, canEditClient = false, users }: ClientListProps) {
  const [query, setQuery] = useState("");
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"compact" | "expanded">("expanded");

  const normalizedQuery = query.trim().toLowerCase();
  const filteredClients = useMemo(() => {
    const visibleClients = normalizedQuery
      ? clients.filter((client) => client.name.toLowerCase().startsWith(normalizedQuery))
      : clients;

    return [...visibleClients].sort((firstClient, secondClient) => {
      const firstPriority = firstClient.status === "PAUSED" || firstClient.status === "INACTIVE" ? 1 : 0;
      const secondPriority = secondClient.status === "PAUSED" || secondClient.status === "INACTIVE" ? 1 : 0;

      if (firstPriority !== secondPriority) {
        return firstPriority - secondPriority;
      }

      return firstClient.name.localeCompare(secondClient.name, "es", { sensitivity: "base" });
    });
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
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
          <div className="relative w-full md:w-96">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cliente..."
              className="pl-10 h-11 rounded-xl bg-card border shadow-sm"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setViewMode((currentMode) => currentMode === "compact" ? "expanded" : "compact")}
            className="h-11 rounded-xl border-border/70 bg-card px-4 shadow-sm"
          >
            {viewMode === "compact" ? (
              <LayoutGrid className="mr-2 h-4 w-4" />
            ) : (
              <Rows3 className="mr-2 h-4 w-4" />
            )}
            {viewMode === "compact" ? "Vista expandida" : "Vista compacta"}
          </Button>
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
        const isDisabledClient = client.status === "PAUSED" || client.status === "INACTIVE";
        const accentColor = isDisabledClient ? "#94a3b8" : userColor;
        const monthlyReels = client.monthlyReels || 0;
        const monthlyFlyers = client.monthlyFlyers || 0;
        const isEditOpen = editingClientId === client.id;
        const cardBackground = isDisabledClient
          ? "linear-gradient(145deg, rgba(148, 163, 184, 0.12) 0%, rgba(148, 163, 184, 0.07) 28%, rgba(148, 163, 184, 0.03) 58%, transparent 100%)"
          : `linear-gradient(145deg, ${hexToRgba(userColor, 0.14)} 0%, ${hexToRgba(userColor, 0.08)} 22%, ${hexToRgba(userColor, 0.03)} 48%, transparent 100%)`;
        const paymentBadgeClassName = isDisabledClient
          ? "bg-slate-100 text-slate-500 border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border"
          : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-muted dark:text-muted-foreground dark:border-border";
        
        const clientCard = (
          <div
            className={`group h-full rounded-[2rem] border border-border/60 bg-card shadow-sm transition-all duration-200 ${viewMode === 'compact' ? 'h-[154px] p-3.5' : 'p-6'} ${isDisabledClient ? 'opacity-75 saturate-0' : 'hover:-translate-y-0.5 hover:shadow-md'} ${canEditClient ? 'cursor-pointer' : 'cursor-not-allowed'} animate-fade-in`}
            style={{
              animationDelay: `${Math.min(index, 6) * 50}ms`,
              backgroundColor: "hsl(var(--card))",
              backgroundImage: cardBackground,
              borderColor: isDisabledClient ? "rgba(148, 163, 184, 0.2)" : hexToRgba(userColor, 0.12),
            }}
          >
            <div className={`${viewMode === 'compact' ? 'mb-0 flex items-start gap-3' : 'mb-5 flex items-start gap-4'}`}>
              {client.logo ? (
                <div 
                  className={`relative flex items-center justify-center overflow-hidden border shadow-sm ${viewMode === 'compact' ? 'h-16 w-16 rounded-[1.4rem]' : 'h-14 w-14 rounded-2xl'}`}
                  style={{ 
                    backgroundColor: hexToRgba(accentColor, isDisabledClient ? 0.08 : 0.1),
                    borderColor: hexToRgba(accentColor, isDisabledClient ? 0.16 : 0.14),
                  }}
                >
                  <Image
                    src={client.logo}
                    alt={client.name}
                    fill
                    className="object-cover"
                    priority={index < 4}
                    sizes={viewMode === 'compact' ? '64px' : '56px'}
                  />
                </div>
              ) : (
                <div 
                  className={`flex items-center justify-center border font-bold shadow-sm ${viewMode === 'compact' ? 'h-16 w-16 rounded-[1.4rem] text-2xl' : 'h-14 w-14 rounded-2xl text-xl'}`}
                  style={{ 
                    backgroundColor: hexToRgba(accentColor, isDisabledClient ? 0.1 : 0.16),
                    color: accentColor,
                    borderColor: hexToRgba(accentColor, isDisabledClient ? 0.16 : 0.14),
                  }}
                >
                  {client.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className={`min-w-0 flex-1 ${isAdmin ? (viewMode === 'compact' ? 'pr-7' : 'pr-8') : ''}`}>
                <div className={`flex items-start justify-between gap-2 ${viewMode === 'compact' ? 'mb-1.5' : 'mb-2'}`}>
                  <h2 className={`${viewMode === 'compact' ? 'line-clamp-2 text-[18px] leading-[1.1]' : 'line-clamp-1 text-xl'} font-bold ${isDisabledClient ? 'text-muted-foreground' : ''}`}>{client.name}</h2>
                  {viewMode === 'expanded' && (
                    <div className="flex items-center gap-1">
                      {client.hasPendingFeedback && (
                        <div className="relative shrink-0">
                          <Bell className="h-4 w-4 text-orange-500" />
                          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {viewMode === 'compact' ? (
                  <div className="flex flex-col items-start gap-1">
                    <Badge
                      className={`h-5 px-2.5 py-0 text-[11px] leading-none font-medium rounded-full ${
                        client.status === "ACTIVE"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : client.status === "PAUSED"
                            ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                            : client.status === "DEBT"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-slate-100 text-slate-600 dark:bg-muted dark:text-muted-foreground"
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

                    {client.monthlyRate && client.monthlyRate > 0 && client.paymentDay && (
                      <>
                        <Badge 
                          variant="outline" 
                          className={`h-5 whitespace-nowrap px-2.5 py-0 text-[11px] leading-none font-medium rounded-full ${paymentBadgeClassName}`}
                        >
                          Cobro: día {client.paymentDay}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={`h-5 whitespace-nowrap px-2.5 py-0 text-[11px] leading-none font-medium rounded-full ${paymentBadgeClassName}`}
                        >
                          {formatCurrency(client.monthlyRate)}
                        </Badge>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <Badge
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          client.status === "ACTIVE"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : client.status === "PAUSED"
                              ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                              : client.status === "DEBT"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-slate-100 text-slate-600 dark:bg-muted dark:text-muted-foreground"
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
                    </div>

                    {client.monthlyRate && client.monthlyRate > 0 && client.paymentDay && (
                      <div className="flex flex-nowrap items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={`whitespace-nowrap px-2 py-0.5 text-xs font-medium rounded-full ${paymentBadgeClassName}`}
                        >
                          Cobro: día {client.paymentDay}
                        </Badge>
                        {isAdmin && (
                          <Badge 
                            variant="outline" 
                            className={`whitespace-nowrap px-2 py-0.5 text-xs font-medium rounded-full ${paymentBadgeClassName}`}
                          >
                            {formatCurrency(client.monthlyRate)}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {viewMode === "expanded" && (
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
              <div
                className="mt-3 grid grid-cols-2 gap-3 rounded-3xl border px-4 py-3"
                style={{
                  backgroundColor: isDisabledClient ? "rgba(148, 163, 184, 0.06)" : hexToRgba(userColor, 0.05),
                  borderColor: isDisabledClient ? "rgba(148, 163, 184, 0.12)" : hexToRgba(userColor, 0.1),
                }}
              >
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
            )}
          </div>
        );

        return (
          <div key={client.id} className="relative">
            <ClientCardContextMenu
              client={client}
              onEdit={() => setEditingClientId(client.id)}
              canEdit={canEditClient}
              isAdmin={isAdmin}
            >
              {canEditClient ? (
                <Link href={`/clients/${client.id}`}>
                  <div className="pointer-events-auto">{clientCard}</div>
                </Link>
              ) : (
                clientCard
              )}
            </ClientCardContextMenu>
            {isAdmin && (
              <div
                className={`absolute z-10 ${viewMode === 'compact' ? 'right-3 top-3' : 'right-4 top-4'}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingClientId(client.id)}
                  className={`${viewMode === 'compact' ? 'h-5 w-5' : 'h-6 w-6'} p-0`}
                  title="Editar cliente"
                >
                  <Edit className={`${viewMode === 'compact' ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
                </Button>
              </div>
            )}
            <EditClientDialog
              client={client}
              open={isEditOpen}
              onOpenChange={(open) => setEditingClientId(open ? client.id : null)}
              users={users}
            />
          </div>
        );
      })}
      </div>
      )}
    </TooltipProvider>
  );
}

