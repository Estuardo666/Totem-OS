"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Client, User } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Edit, FileText, Bell } from "lucide-react";
import { EditClientDialog } from "./edit-client-dialog";
import { ShareReportButton } from "./share-report-button";

interface ClientHeaderProps {
  client: Client & { hasPendingFeedback?: boolean };
  users: User[];
}

export function ClientHeader({ client, users }: ClientHeaderProps) {
  const router = useRouter();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentShareToken, setCurrentShareToken] = useState<string | null>(
    (client as any).shareToken || null
  );

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "Activo";
      case "PAUSED":
        return "Pausado";
      case "DEBT":
        return "En Deuda";
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
      default:
        return "secondary";
    }
  };

  return (
    <Card className="border-none shadow-sm">
      <CardContent className="flex flex-col gap-4 p-4 md:p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
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
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <ShareReportButton
            clientId={client.id}
            shareToken={currentShareToken}
            onTokenGenerated={(token) => {
              setCurrentShareToken(token);
              router.refresh();
            }}
            className="w-full sm:w-auto"
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

