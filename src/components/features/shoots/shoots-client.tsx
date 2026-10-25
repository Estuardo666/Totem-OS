"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShootsView } from "./shoots-view";
import type { ShootWithRelations } from "@/lib/shooting-service";
import type { Client } from "@prisma/client";
import { AppPageHeader } from "@/components/shared/app-page-header";

interface ShootsClientProps {
  shootings: ShootWithRelations[];
  clients: Client[];
}

export function ShootsClient({ shootings, clients }: ShootsClientProps) {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* iOS Style Header */}
      <AppPageHeader
        title="Plan de Rodaje"
        description="Gestiona y visualiza todos los rodajes programados"
        actions={
          <>
            <Button
              onClick={() => document.getElementById("shoots-new-button")?.click()}
              className="rounded-full shadow-sm"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden md:inline">Nuevo Rodaje</span>
            </Button>
          </>
        }
      />

      {/* Main Content */}
      <div className="container mx-auto p-3">
        <ShootsView shootings={shootings} clients={clients} />
        {/* Hidden button that ShootsView will trigger */}
        <button
          id="shoots-new-button"
          className="hidden"
          data-trigger="new-shooting"
        />
      </div>
    </div>
  );
}
