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

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "default";
      case "PAUSED":
        return "secondary";
      case "DEBT":
        return "destructive";
      case "INACTIVE":
        return "secondary";
      default:
        return "secondary";
    }
  };

  return (
    <Card className="border-none shadow-sm">
      <CardContent className="flex flex-col gap-4 p-4 md:p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {/* Logo/Avatar */}
            <div className="relative h-24 w-24 rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center flex-shrink-0">
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
                  className="h-full w-full rounded-lg flex items-center justify-center text-white font-bold text-3xl"
                  style={{ backgroundColor: hexToRgba(client.color || "#000000", 0.2) }}
                >
                  {client.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold">{client.name}</h1>
            {client.hasPendingFeedback && (
              <div className="relative">
                <Bell className="h-5 w-5 text-red-600" />
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-600 rounded-full border-2 border-white"></span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={getStatusVariant(client.status)}
              className={
                client.status === "ACTIVE"
                  ? "w-fit bg-green-500 hover:bg-green-600 text-white border-transparent"
                  : client.status === "PAUSED"
                    ? "w-fit bg-gray-500 hover:bg-gray-600 text-white border-transparent"
                    : client.status === "INACTIVE"
                      ? "w-fit bg-slate-400 hover:bg-slate-500 text-white border-transparent"
                    : "w-fit"
              }
            >
              {getStatusLabel(client.status)}
            </Badge>
            {client.hasPendingFeedback && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                Feedback pendiente de revisar
              </Badge>
            )}
          </div>
          {contactEmails.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Correos electrónicos:</span>
              {contactEmails.map((email) => (
                <span key={email} className="rounded-full border px-2 py-0.5 text-xs">
                  {email}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
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
                className="justify-center rounded-full"
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
                className="justify-center rounded-full"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditDialogOpen(true)}
                className="justify-center rounded-full"
              >
                <Edit className="h-4 w-4 mr-1.5" />
                Editar
              </Button>
            </>
          )}
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

