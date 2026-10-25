"use client";

import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import type { Client, User } from "@prisma/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import { EditClientDialog } from "./edit-client-dialog";
import { ClientCardContextMenu } from "./client-card-context-menu";

type ClientRow = Client & {
  hasPendingFeedback?: boolean;
  reelsCompleted: number;
  flyersCompleted: number;
  publishedTasksCount: number;
  pendingTasksCount: number;
  nextShootDate: Date | null;
  lastPostDate: Date | null;
  lastPostTask?: { title: string; postCopy?: string };
  nextShootDetails?: { title: string; address?: string };
};

interface ClientListProps {
  clients: ClientRow[];
  isAdmin: boolean;
  canEditClient?: boolean;
  users: User[];
}

type StatusFilter = "ALL" | "ACTIVE" | "DEBT" | "PAUSED";
type ViewMode = "grid" | "list";

const VIEW_STORAGE_KEY = "totem:clients-view";

const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  ACTIVE: { label: "Activo", dot: "bg-[hsl(var(--theme-success))]", text: "text-[hsl(var(--theme-success))]" },
  DEBT: { label: "En deuda", dot: "bg-[hsl(var(--theme-error))]", text: "text-[hsl(var(--theme-error))]" },
  PAUSED: { label: "Pausado", dot: "bg-muted-foreground/60", text: "text-muted-foreground" },
  INACTIVE: { label: "Inactivo", dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
};

const isDormant = (status: string) => status === "PAUSED" || status === "INACTIVE";

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function formatShortDate(date: Date): string {
  return format(date, "d MMM, HH:mm", { locale: es });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ClientList({ clients, isAdmin, canEditClient = false, users }: ClientListProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  // La vista elegida es una preferencia personal del navegador.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === "grid" || stored === "list") setViewMode(stored);
    } catch {}
  }, []);

  const changeView = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {}
  };

  const counts = useMemo(() => ({
    ALL: clients.length,
    ACTIVE: clients.filter((c) => c.status === "ACTIVE").length,
    DEBT: clients.filter((c) => c.status === "DEBT").length,
    PAUSED: clients.filter((c) => isDormant(c.status)).length,
  }), [clients]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredClients = useMemo(() => {
    const visible = clients.filter((client) => {
      if (normalizedQuery && !client.name.toLowerCase().includes(normalizedQuery)) return false;
      if (statusFilter === "PAUSED") return isDormant(client.status);
      if (statusFilter !== "ALL") return client.status === statusFilter;
      return true;
    });

    // Activos primero; dentro de cada grupo, orden alfabético.
    return visible.sort((a, b) => {
      const pa = isDormant(a.status) ? 1 : 0;
      const pb = isDormant(b.status) ? 1 : 0;
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    });
  }, [clients, normalizedQuery, statusFilter]);

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-card px-6 py-16 text-center">
        <h2 className="text-xl font-semibold">Aún no hay clientes</h2>
        <p className="mt-1 text-sm text-muted-foreground">Crea tu primer cliente para comenzar.</p>
      </div>
    );
  }

  const editingClient = editingClientId ? clients.find((c) => c.id === editingClientId) : undefined;

  return (
    <TooltipProvider delayDuration={300}>
      {/* Barra de herramientas: búsqueda, filtro de estado y vista */}
      <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar cliente"
            aria-label="Buscar cliente"
            className="h-10 rounded-xl border-transparent bg-card sm:w-72"
          />
          <Segmented
            label="Filtrar por estado"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "ALL", label: "Todos", count: counts.ALL },
              { value: "ACTIVE", label: "Activos", count: counts.ACTIVE },
              { value: "DEBT", label: "En deuda", count: counts.DEBT },
              { value: "PAUSED", label: "Pausados", count: counts.PAUSED },
            ]}
          />
        </div>
        <Segmented
          label="Vista"
          value={viewMode}
          onChange={changeView}
          options={[
            { value: "grid", label: "Tarjetas" },
            { value: "list", label: "Lista" },
          ]}
        />
      </div>

      {filteredClients.length === 0 ? (
        <div className="rounded-2xl bg-card px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            {normalizedQuery ? <>Ningún cliente coincide con “{query}”.</> : "No hay clientes en este estado."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredClients.map((client, index) => (
            <ClientShell key={client.id} client={client} canEditClient={canEditClient} isAdmin={isAdmin} onEdit={() => setEditingClientId(client.id)}>
              <ClientCard client={client} index={index} isAdmin={isAdmin} canEditClient={canEditClient} onEdit={() => setEditingClientId(client.id)} />
            </ClientShell>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card p-1.5">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.3fr)] gap-4 px-4 pb-2 pt-3 text-xs font-medium text-muted-foreground md:grid">
            <span>Cliente</span>
            <span>Cobro</span>
            <span>Entregables del mes</span>
            <span>Tareas</span>
            <span>Próximo rodaje</span>
          </div>
          {filteredClients.map((client, index) => (
            <ClientShell key={client.id} client={client} canEditClient={canEditClient} isAdmin={isAdmin} onEdit={() => setEditingClientId(client.id)}>
              <ClientRowView client={client} index={index} isAdmin={isAdmin} />
            </ClientShell>
          ))}
        </div>
      )}

      {editingClient && (
        <EditClientDialog
          client={editingClient}
          open
          onOpenChange={(open) => setEditingClientId(open ? editingClient.id : null)}
          users={users}
        />
      )}
    </TooltipProvider>
  );
}

/* ───────────── piezas ───────────── */

/** Envuelve una tarjeta o fila con el menú contextual y el enlace al detalle. */
function ClientShell({
  client,
  canEditClient,
  isAdmin,
  onEdit,
  children,
}: {
  client: ClientRow;
  canEditClient: boolean;
  isAdmin: boolean;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <ClientCardContextMenu client={client} onEdit={onEdit} canEdit={canEditClient} isAdmin={isAdmin}>
      {canEditClient ? (
        <Link href={`/clients/${client.id}`} className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {children}
        </Link>
      ) : (
        <div className="group">{children}</div>
      )}
    </ClientCardContextMenu>
  );
}

function ClientAvatar({ client, size }: { client: ClientRow; size: "md" | "sm" }) {
  const dormant = isDormant(client.status);
  const color = dormant ? "#94a3b8" : client.color || "#6366f1";
  const box = size === "md" ? "h-12 w-12 rounded-lg text-lg" : "h-9 w-9 rounded-md text-sm";
  return (
    <div
      className={cn("relative flex shrink-0 items-center justify-center overflow-hidden font-semibold", box, dormant && "grayscale")}
      style={{ backgroundColor: hexToRgba(color, 0.14), color }}
    >
      {client.logo ? (
        <Image src={client.logo} alt="" fill className="object-cover" sizes={size === "md" ? "48px" : "36px"} />
      ) : (
        client.name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

function StatusLabel({ status, pendingFeedback }: { status: string; pendingFeedback?: boolean }) {
  const meta = STATUS_META[status] ?? STATUS_META.INACTIVE;
  return (
    <span className="flex items-center gap-3 text-xs">
      <span className={cn("inline-flex items-center gap-1.5 font-medium", meta.text)}>
        <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
        {meta.label}
      </span>
      {pendingFeedback && (
        <span className="inline-flex items-center gap-1.5 font-medium text-[hsl(var(--theme-warning))]">
          <span className="size-1.5 rounded-full bg-[hsl(var(--theme-warning))] motion-safe:animate-pulse" aria-hidden />
          Feedback pendiente
        </span>
      )}
    </span>
  );
}

function Progress({ label, done, total, color }: { label: string; done: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const complete = total > 0 && done >= total;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("text-sm font-semibold tabular-nums", complete && "text-[hsl(var(--theme-success))]")}>
          {done}<span className="font-normal text-muted-foreground">/{total}</span>
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/[0.07]" role="progressbar" aria-label={label} aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: complete ? "hsl(var(--theme-success))" : color }}
        />
      </div>
    </div>
  );
}

/** Valor con detalle opcional en tooltip (sin icono: el propio texto es el disparador). */
function DetailValue({ value, title, detail }: { value: string; title?: string; detail?: string }) {
  if (!title) return <span className="truncate text-sm">{value}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help truncate text-sm underline decoration-muted-foreground/40 decoration-dotted underline-offset-4">{value}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-medium">{title}</p>
        {detail && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{detail}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

function ClientCard({
  client,
  index,
  isAdmin,
  canEditClient,
  onEdit,
}: {
  client: ClientRow;
  index: number;
  isAdmin: boolean;
  canEditClient: boolean;
  onEdit: () => void;
}) {
  const dormant = isDormant(client.status);
  const accent = dormant ? "hsl(var(--muted-foreground))" : client.color || "#6366f1";
  const hasBilling = Boolean(client.monthlyRate && client.monthlyRate > 0 && client.paymentDay);

  return (
    <article
      className={cn(
        "relative flex h-full flex-col rounded-2xl bg-card p-5 animate-fade-in-up",
        "transition-[transform,box-shadow] duration-200 ease-out",
        dormant && "opacity-70"
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms`, animationFillMode: "both" }}
    >
      {/* Identidad */}
      <div className="flex items-start gap-3.5">
        <ClientAvatar client={client} size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-1 text-base font-semibold leading-6">{client.name}</h2>
          <div className="mt-1">
            <StatusLabel status={client.status} pendingFeedback={client.hasPendingFeedback} />
          </div>
        </div>
        {isAdmin && canEditClient && (
          <button
            type="button"
            data-pressable=""
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onEdit();
            }}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-primary/[0.1] hover:text-foreground focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
          >
            Editar
          </button>
        )}
      </div>

      {hasBilling && (
        <p className="mt-3 text-xs text-muted-foreground">
          Cobro el día {client.paymentDay}
          {isAdmin && <> · <span className="font-medium text-foreground">{formatCurrency(client.monthlyRate!)}</span> al mes</>}
        </p>
      )}

      {/* Entregables del mes */}
      <div className="mt-5 grid grid-cols-2 gap-4">
        <Progress label="Reels" done={client.reelsCompleted} total={client.monthlyReels || 0} color={accent} />
        <Progress label="Flyers" done={client.flyersCompleted} total={client.monthlyFlyers || 0} color={accent} />
      </div>

      {/* Actividad: agrupada en un panel interior, separada por espacio */}
      <dl className="mt-5 space-y-2.5 rounded-lg bg-popover px-3.5 py-3">
        <div className="flex items-center justify-between gap-3">
          <dt className="shrink-0 text-xs text-muted-foreground">Último posteo</dt>
          <dd className="min-w-0 text-right">
            <DetailValue
              value={client.lastPostDate ? formatShortDate(new Date(client.lastPostDate)) : "Nunca"}
              title={client.lastPostDate ? client.lastPostTask?.title : undefined}
              detail={client.lastPostTask?.postCopy}
            />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="shrink-0 text-xs text-muted-foreground">Próximo rodaje</dt>
          <dd className="min-w-0 text-right">
            <DetailValue
              value={client.nextShootDate ? formatShortDate(new Date(client.nextShootDate)) : "Sin programar"}
              title={client.nextShootDate ? client.nextShootDetails?.title : undefined}
              detail={client.nextShootDetails?.address}
            />
          </dd>
        </div>
      </dl>

      {/* Tareas */}
      <div className="mt-auto flex items-end gap-6 pt-5">
        <div>
          <p className="text-2xl font-semibold tabular-nums leading-none">{client.pendingTasksCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Pendientes</p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums leading-none text-muted-foreground">{client.publishedTasksCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Publicadas</p>
        </div>
      </div>
    </article>
  );
}

function ClientRowView({ client, index, isAdmin }: { client: ClientRow; index: number; isAdmin: boolean }) {
  const dormant = isDormant(client.status);
  const accent = dormant ? "hsl(var(--muted-foreground))" : client.color || "#6366f1";
  const hasBilling = Boolean(client.monthlyRate && client.monthlyRate > 0 && client.paymentDay);

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl px-4 py-3 transition-colors duration-150 hover:bg-primary/[0.1] animate-fade-in",
        "md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.3fr)]",
        dormant && "opacity-70"
      )}
      style={{ animationDelay: `${Math.min(index, 10) * 25}ms`, animationFillMode: "both" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <ClientAvatar client={client} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{client.name}</p>
          <StatusLabel status={client.status} pendingFeedback={client.hasPendingFeedback} />
        </div>
      </div>

      <div className="hidden text-sm md:block">
        {hasBilling ? (
          <>
            <p>Día {client.paymentDay}</p>
            {isAdmin && <p className="text-xs text-muted-foreground">{formatCurrency(client.monthlyRate!)}</p>}
          </>
        ) : (
          <p className="text-muted-foreground">—</p>
        )}
      </div>

      <div className="hidden grid-cols-2 gap-3 md:grid">
        <Progress label="Reels" done={client.reelsCompleted} total={client.monthlyReels || 0} color={accent} />
        <Progress label="Flyers" done={client.flyersCompleted} total={client.monthlyFlyers || 0} color={accent} />
      </div>

      <div className="text-right text-sm md:text-left">
        <p className="font-semibold tabular-nums">{client.pendingTasksCount} <span className="font-normal text-muted-foreground">pendientes</span></p>
        <p className="text-xs text-muted-foreground tabular-nums">{client.publishedTasksCount} publicadas</p>
      </div>

      <div className="hidden min-w-0 md:block">
        <DetailValue
          value={client.nextShootDate ? formatShortDate(new Date(client.nextShootDate)) : "Sin programar"}
          title={client.nextShootDate ? client.nextShootDetails?.title : undefined}
          detail={client.nextShootDetails?.address}
        />
      </div>
    </div>
  );
}
