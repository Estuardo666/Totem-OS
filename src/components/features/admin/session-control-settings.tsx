"use client";

import { useState } from "react";
import { LogOut, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
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
import { forceLogoutAllSessionsAction } from "@/actions/session-actions";

export function SessionControlSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleForceLogoutAll = async () => {
    setIsLoading(true);
    try {
      const result = await forceLogoutAllSessionsAction();
      
      if (result.success) {
        toast({
          title: "Orden enviada",
          description: result.message,
        });
        setDialogOpen(false);
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al forzar logout:", error);
      toast({
        title: "Error",
        description: "Error al enviar la orden de cierre",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-1">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="text-base font-semibold">Sesiones</h3>
            <p className="text-xs text-muted-foreground">Administra las sesiones activas</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="divide-y">
        {/* Info Row */}
        <div className="flex items-center gap-3 px-5 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Sesiones activas</p>
            <p className="text-xs text-muted-foreground">Todos los usuarios conectados actualmente</p>
          </div>
        </div>

        {/* Danger Zone Row */}
        <div className="px-5 py-3">
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive">Zona de peligro</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Esta acción cerrará la sesión de todos los usuarios, incluyendo la tuya.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-5 pt-3">
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button 
              variant="destructive" 
              size="sm"
              className="w-full"
              disabled={isLoading}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar todas las sesiones
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                ¿Cerrar todas las sesiones?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción enviará una orden de cierre de sesión a todos los usuarios conectados. 
                Cada usuario verá una notificación antes de ser redirigido a la página de inicio de sesión.
                <br /><br />
                <strong>Tu propia sesión también será cerrada.</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleForceLogoutAll}
                disabled={isLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isLoading ? "Enviando..." : "Confirmar cierre"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
