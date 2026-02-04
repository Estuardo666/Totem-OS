"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Client, User } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Edit, FileText, Bell, Trash2 } from "lucide-react";
import Image from "next/image";
import { EditClientDialog } from "./edit-client-dialog";
import { ShareReportButton } from "./share-report-button";
import { deleteClient } from "@/actions/client-actions";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
}

export function ClientHeader({ client, users }: ClientHeaderProps) {
  const router = useRouter();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
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

  const handleDelete = () => {
    startDeleteTransition(async () => {
      const result = await deleteClient(client.id);
      if (result.success) {
        toast({
          title: "Cliente eliminado",
          description: "Se eliminó el cliente y toda su información asociada.",
        });
        router.push("/clients");
        router.refresh();
        return;
      }

      toast({
        variant: "destructive",
        title: "Error al eliminar",
        description: result.error || "No se pudo eliminar el cliente.",
      });
    });
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
            <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center flex-shrink-0">
              {client.logo ? (
                <Image
                  src={client.logo}
                  alt={client.name}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              ) : (
                <div 
                  className="h-full w-full rounded-lg flex items-center justify-center text-white font-bold text-xl"
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
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <ShareReportButton
            clientId={client.id}
            shareToken={currentShareToken}
            onTokenGenerated={(token) => {
              setCurrentShareToken(token);
              router.refresh();
            }}
          />
          <Button
            variant="default"
            size="sm"
            asChild
            className="w-full sm:w-auto"
          >
            <Link 
              href={`/clients/${client.id}/report`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText className="h-4 w-4 mr-2" />
              Generar Reporte
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditDialogOpen(true)}
            className="w-full sm:w-auto"
          >
            <Edit className="h-4 w-4 mr-2" />
            Editar Cliente
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción eliminará todas las tareas, finanzas y datos asociados a
                  <strong className="text-foreground"> {client.name}</strong>. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? "Eliminando..." : "Eliminar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>

      <EditClientDialog
        client={client}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        users={users}
      />
    </Card>
  );
}

