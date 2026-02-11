"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Client, User } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Edit, FileText, Bell } from "lucide-react";
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

  return (
    <Card className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <CardContent className="p-0">
        {/* Header con color de marca */}
        {client.color && (
          <div 
            className="h-2"
            style={{ backgroundColor: client.color }}
          />
        )}
        
        <div className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            {/* Logo y info principal */}
            <div className="flex items-start gap-4 flex-1">
              {/* Logo/Avatar iOS style */}
              <div 
                className="relative h-20 w-20 md:h-24 md:w-24 rounded-2xl overflow-hidden flex-shrink-0 ring-2 ring-border/50 shadow-md"
                style={{ 
                  backgroundColor: client.color ? hexToRgba(client.color, 0.1) : 'var(--muted)' 
                }}
              >
                {client.logo ? (
                  <Image
                    src={client.logo}
                    alt={client.name}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                ) : (
                  <div 
                    className="h-full w-full flex items-center justify-center text-3xl md:text-4xl font-bold"
                    style={{ color: client.color || 'var(--muted-foreground)' }}
                  >
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              
              {/* Nombre y status */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl md:text-3xl font-bold truncate">
                    {client.name}
                  </h1>
                  {client.hasPendingFeedback && (
                    <div className="relative flex-shrink-0">
                      <Bell className="h-5 w-5 text-orange-500" />
                      <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-orange-500 rounded-full animate-pulse" />
                    </div>
                  )}
                </div>
                
                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                      client.status === "ACTIVE"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : client.status === "PAUSED"
                          ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                          : client.status === "DEBT"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {getStatusLabel(client.status)}
                  </Badge>
                  {client.hasPendingFeedback && (
                    <Badge 
                      variant="outline" 
                      className="text-xs bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800"
                    >
                      Feedback pendiente
                    </Badge>
                  )}
                </div>

                {/* Emails de contacto */}
                {contactEmails.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {contactEmails.map((email) => (
                      <span 
                        key={email} 
                        className="inline-flex items-center rounded-md bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {email}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Acciones - layout mejorado */}
            <div className="flex flex-wrap gap-2 md:flex-col lg:flex-row">
              {isAdmin && (
                <>
                  <ShareReportButton
                    clientId={client.id}
                    shareToken={currentShareToken}
                    onTokenGenerated={(token) => {
                      setCurrentShareToken(token);
                      router.refresh();
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="rounded-lg h-9"
                  >
                    <Link 
                      href={`/clients/${client.id}/report`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FileText className="h-4 w-4 mr-1.5" />
                      Reporte
                    </Link>
                  </Button>
                </>
              )}
              {canEditClient && (
                <>
                  <BulkTaskDialog
                    clients={[client]}
                    label="Crear tareas"
                    buttonVariant="outline"
                    buttonSize="sm"
                    className="rounded-lg h-9"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditDialogOpen(true)}
                    className="rounded-lg h-9"
                  >
                    <Edit className="h-4 w-4 mr-1.5" />
                    Editar
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      {canEditClient && (
        <EditClientDialog
          client={client}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          users={users}
        />
      )}
    </Card>
  );
}

