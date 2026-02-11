"use client";

import { useState } from "react";
import { LogOut, AlertTriangle, Users } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Control de Sesiones
        </CardTitle>
        <CardDescription>
          Administra las sesiones activas de todos los usuarios
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                Zona de Peligro
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Cerrar todas las sesiones forzará a todos los usuarios a volver a iniciar sesión.
              </p>
            </div>
          </div>
        </div>

        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button 
              variant="destructive" 
              className="w-full"
              disabled={isLoading}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Todas las Sesiones
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
                {isLoading ? "Enviando..." : "Confirmar Cierre"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
