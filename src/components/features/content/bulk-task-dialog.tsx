"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Client } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BulkTaskCreator } from "./bulk-task-creator";

// Client-only icon to avoid hydration mismatch
const LayersIcon = dynamic(() => import("lucide-react").then((mod) => ({ default: mod.Layers })), {
  ssr: false,
});

interface BulkTaskDialogProps {
  clients: Client[];
  defaultOpen?: boolean;
  label?: string;
  buttonVariant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showIcon?: boolean;
}

export function BulkTaskDialog({
  clients,
  defaultOpen = false,
  label = "Crear tareas en lote",
  buttonVariant = "default",
  buttonSize = "default",
  className,
  showIcon = true,
}: BulkTaskDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize} className={className}>
          {showIcon && isClient && <LayersIcon className={`${buttonSize === "sm" ? "mr-1.5 h-3.5 w-3.5" : "mr-2 h-4 w-4"}`} />}
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[90vw] sm:w-[78vw] md:w-[62vw] lg:w-[42vw] xl:w-[35vw] max-w-2xl max-h-[90vh] p-0 overflow-hidden mx-auto">
        <div className="px-8 pt-[2em] pb-2 md:px-6 md:pt-3 md:pb-0">
          <DialogHeader className="px-0 w-full mb-0">
            <div className="flex flex-col gap-0.5 w-full items-start text-left md:items-center md:text-center pl-4 md:pl-0 pb-2 md:pb-0">
              <DialogTitle className="text-xl md:text-3xl font-semibold leading-tight">Crear tareas en lote</DialogTitle>
              <DialogDescription className="text-sm md:text-lg leading-snug break-words w-full">
                Pega un listado de tareas para crear múltiples tareas a la vez
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>
        <div className="px-4 pb-4 pt-0 md:px-6 md:pb-5 transition-[height,max-height] duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[height]">
          <BulkTaskCreator clients={clients} variant="dialog" showHeader={false} onSuccess={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
