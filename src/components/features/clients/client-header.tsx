"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Client, User } from "@prisma/client";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { EditClientDialog } from "./edit-client-dialog";
import { ShareReportButton } from "./share-report-button";
import { useToast } from "@/components/ui/use-toast";
import { BulkTaskDialog } from "../content/bulk-task-dialog";

// Helper para convertir hex a rgba (copiado de client-list.tsx)
const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Helper para formatear dinero
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

interface ClientHeaderProps {
  client: Client & { hasPendingFeedback?: boolean };
  users: User[];
  isAdmin?: boolean;
  canEditClient?: boolean;
  onDeleteClick?: () => void;
}

export function ClientHeader({ client, users, isAdmin = false, canEditClient = false, onDeleteClick }: ClientHeaderProps) {
  const router = useRouter();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const [currentShareToken, setCurrentShareToken] = useState<string | null>(
    (client as any).shareToken || null
  );
  const contactEmails = (() => {
    if (!(client as any).contactEmails) return [] as string[];
    try {
      const parsed = JSON.parse((client as any).contactEmails) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [] as string[];
    }
  })();

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "Activo";
      case "PAUSED":
        return "Pausado";
      case "DEBT":
        return "En Deuda";
      case "INACTIVE":
        return "Inactivo";
      default:
        return status;
    }
  };

  const accent = client.color || "#6366f1";
  const statusTone: Record<string, string> = {
    ACTIVE: "bg-[hsl(var(--theme-success))]",
    DEBT: "bg-[hsl(var(--theme-error))]",
    PAUSED: "bg-muted-foreground/60",
    INACTIVE: "bg-muted-foreground/40",
  };
  const hasBilling = Boolean(client.monthlyRate && client.monthlyRate > 0 && client.paymentDay);

  return (
    <section
      className="relative overflow-hidden rounded-2xl bg-card p-5 md:p-6"
      // El color del cliente tiñe el contenedor en lugar de una franja (sin líneas).
      style={{ backgroundImage: `linear-gradient(135deg, ${hexToRgba(accent, 0.12)} 0%, ${hexToRgba(accent, 0.04)} 45%, transparent 75%)` }}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4 md:gap-5">
          {/* Radio concéntrico: contenedor 24px − margen → 16px */}
          <div
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl md:h-[4.5rem] md:w-[4.5rem]"
            style={{ backgroundColor: hexToRgba(accent, 0.16) }}
          >
            {client.logo ? (
              <Image src={client.logo} alt={client.name} fill className="object-cover" sizes="72px" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-semibold" style={{ color: accent }}>
                {client.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-1.5">
            <h1 className="truncate text-3xl font-semibold">{client.name}</h1>
            <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <span className={`size-2 rounded-full ${statusTone[client.status] ?? statusTone.INACTIVE}`} aria-hidden />
                {getStatusLabel(client.status)}
              </span>
              {hasBilling && (
                <>
                  <span aria-hidden>·</span>
                  <span>Cobro el día {client.paymentDay}</span>
                  {isAdmin && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="font-medium text-foreground tabular-nums">{formatCurrency(client.monthlyRate)}</span>
                      <span>al mes</span>
                    </>
                  )}
                </>
              )}
              {client.hasPendingFeedback && (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-[hsl(var(--theme-warning))]">
                    <span className="size-2 rounded-full bg-[hsl(var(--theme-warning))] motion-safe:animate-pulse" aria-hidden />
                    Feedback pendiente
                  </span>
                </>
              )}
            </p>
            {contactEmails.length > 0 && (
              <p className="truncate text-xs text-muted-foreground">{contactEmails.join(" · ")}</p>
            )}
          </div>
        </div>

        {/* Acciones: la principal (crear tareas) va rellena, el resto tintadas */}
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {isAdmin && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditDialogOpen(true);
                }}
              >
                Editar
              </Button>
              <ShareReportButton
                clientId={client.id}
                shareToken={currentShareToken}
                onTokenGenerated={(token) => {
                  setCurrentShareToken(token);
                  router.refresh();
                }}
              />
              <Button variant="outline" size="sm" asChild>
                <Link href={`/clients/${client.id}/report`} target="_blank" rel="noopener noreferrer">
                  Reporte
                </Link>
              </Button>
            </>
          )}
          {canEditClient && (
            <BulkTaskDialog clients={[client]} label="Crear tareas" buttonVariant="default" buttonSize="sm" />
          )}
        </div>
      </div>

      {isAdmin && (
        <EditClientDialog
          client={client}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          users={users}
        />
      )}
    </section>
  );
}

