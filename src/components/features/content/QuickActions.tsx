import Link from "next/link";
import type { Client } from "@prisma/client";
import { Plus, Layout, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BulkTaskDialog } from "./bulk-task-dialog";

interface QuickActionsProps {
  clients: Client[];
}

export function QuickActions({ clients }: QuickActionsProps) {
  const activeClients = clients.filter((client) => client.status !== "INACTIVE");

  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/content">
        <Button 
          variant="outline" 
          size="sm"
          className="rounded-full border-2 border-border font-medium hover:bg-muted/50"
        >
          <Layout className="w-4 h-4 mr-2" />
          Ver Tablero
        </Button>
      </Link>
      <Link href="/content/shoots">
        <Button 
          variant="outline" 
          size="sm"
          className="rounded-full border-2 border-border font-medium hover:bg-muted/50"
        >
          <Video className="w-4 h-4 mr-2" />
          Ver Rodajes
        </Button>
      </Link>
      <Link href="/content/new">
        <Button 
          variant="outline" 
          size="sm"
          className="rounded-full border-2 border-border font-medium hover:bg-muted/50"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Tarea
        </Button>
      </Link>
      <BulkTaskDialog
        clients={activeClients}
        label="Crear en lote"
        buttonVariant="outline"
        buttonSize="sm"
      />
    </div>
  );
}

