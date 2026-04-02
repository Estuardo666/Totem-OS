"use client";

import { Plus, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShootsView } from "./shoots-view";
import type { ShootWithRelations } from "@/lib/shooting-service";
import type { Client } from "@prisma/client";

interface ShootsClientProps {
  shootings: ShootWithRelations[];
  clients: Client[];
}

export function ShootsClient({ shootings, clients }: ShootsClientProps) {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* iOS Style Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Left side: Icon + Title + Description */}
          <div className="flex items-center gap-4">
            {/* Gradient Icon */}
            <Video className="h-6 w-6 text-foreground flex-shrink-0" />
            
            {/* Title + Description */}
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-foreground dark:text-white line-clamp-1">
                Plan de Rodaje
              </h1>
              <p className="text-xs text-muted-foreground line-clamp-1">
                Gestiona y visualiza todos los rodajes programados
              </p>
            </div>
          </div>

          {/* Right side: Action Buttons */}
          <div className="flex gap-2 items-center flex-shrink-0">
            <Button
              onClick={() => document.getElementById("shoots-new-button")?.click()}
              className="rounded-full shadow-sm"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden md:inline">Nuevo Rodaje</span>
            </Button>
          </div>
        </div>
      </div>

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
