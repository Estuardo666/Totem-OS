"use client";

import { useState } from "react";
import { LogOut, AlertTriangle, Users, Shield } from "lucide-react";
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
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Control de Sesiones</h3>
            <p className="text-xs text-muted-foreground">Administra las sesiones activas</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="divide-y">
        {/* Info Row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Sesiones activas</p>
            <p className="text-xs text-muted-foreground">Todos los usuarios conectados actualmente</p>
          </div>
        </div>

        {/* Danger Zone Row */}
        <div className="px-4 py-3">
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-destructive/10 shrink-0">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
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
      <div className="px-4 py-3 border-t bg-muted/30">
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
