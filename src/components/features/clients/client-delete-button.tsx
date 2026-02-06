"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteClient } from "@/actions/client-actions";
import { useToast } from "@/components/ui/use-toast";
import { useRedirectOnAuthError } from "@/hooks/use-redirect-on-auth-error";
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

interface ClientDeleteButtonProps {
  clientId: string;
  clientName: string;
}

export function ClientDeleteButton({ clientId, clientName }: ClientDeleteButtonProps) {
  const [isDeleting, startDeleteTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  const handleAuthError = useRedirectOnAuthError();

  const handleDelete = () => {
    startDeleteTransition(async () => {
      const result = await deleteClient(clientId);
      if (result.success) {
        toast({
          title: "Cliente eliminado",
          description: "Se eliminó el cliente y toda su información asociada.",
        });
        router.push("/clients");
        router.refresh();
        return;
      }

      if (handleAuthError(result)) {
        toast({
          variant: "destructive",
          title: "Sesión expirada",
          description: "Tu sesión ha expirado. Serás redirigido al login.",
        });
        return;
      }

      toast({
        variant: "destructive",
        title: "Error al eliminar",
        description: result.error || "No se pudo eliminar el cliente.",
      });
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Eliminar cliente"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Eliminar cliente</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción eliminará todas las tareas, finanzas y datos asociados a
            <strong className="text-foreground"> {clientName}</strong>. No se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Eliminando..." : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
