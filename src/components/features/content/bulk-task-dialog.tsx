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
import { Layers } from "lucide-react";

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
          {showIcon && isClient && <Layers className={`${buttonSize === "sm" ? "mr-1.5 h-3.5 w-3.5" : "mr-2 h-4 w-4"}`} />}
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col min-h-0">
        <div className="sticky top-0 z-10 -mx-6 -mt-6 px-6 pt-6 pb-4 border-b bg-white/50 dark:bg-background/50 backdrop-blur-xl rounded-t-[2.5rem]">
          <DialogHeader>
            <div className="flex flex-col gap-1.5">
              <DialogTitle className="text-2xl font-bold">Crear tareas en lote</DialogTitle>
              <DialogDescription className="text-sm">
                Pega un listado de tareas para crear múltiples tareas a la vez
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>
        <div className="overflow-y-auto px-6 py-4 flex-1 custom-scroll">
          <BulkTaskCreator clients={clients} variant="dialog" showHeader={false} onSuccess={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
