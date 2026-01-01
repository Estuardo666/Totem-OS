"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAllAsRead } from "@/actions/notification-actions";
import { useToast } from "@/components/ui/use-toast";

export function MarkAllAsReadButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleMarkAllAsRead = () => {
    startTransition(async () => {
      try {
        const result = await markAllAsRead();
        if (result.success) {
          toast({
            title: "Notificaciones marcadas como leídas",
            description: `${result.data?.count || 0} notificaciones actualizadas`,
          });
          router.refresh();
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: result.error || "No se pudieron marcar las notificaciones",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Ocurrió un error inesperado",
        });
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleMarkAllAsRead}
      disabled={isPending}
    >
      <CheckCheck className="mr-2 h-4 w-4" />
      {isPending ? "Marcando..." : "Marcar todo como leído"}
    </Button>
  );
}

