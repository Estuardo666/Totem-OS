"use client";

import { Button } from "@/components/ui/button";
import { Plus, Film, Layout, Video, Wand2 } from "lucide-react";
import Link from "next/link";

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/content">
        <Button variant="outline" size="sm">
          <Layout className="w-4 h-4 mr-2" />
          Ver Tablero
        </Button>
      </Link>
      <Link href="/content/shoots">
        <Button variant="outline" size="sm">
          <Video className="w-4 h-4 mr-2" />
          Ver Rodajes
        </Button>
      </Link>
      <Link href="/content/new">
        <Button variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Tarea
        </Button>
      </Link>
      <Link href="/content/generator">
        <Button variant="outline" size="sm">
          <Wand2 className="w-4 h-4 mr-2" />
          Generador
        </Button>
      </Link>
    </div>
  );
}

