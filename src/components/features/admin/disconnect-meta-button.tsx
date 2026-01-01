"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { disconnectMetaAccount } from "@/actions/meta-actions";
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
import { useToast } from "@/components/ui/use-toast";
import { Trash2, Loader2 } from "lucide-react";

/**
 * Botón para desconectar la cuenta de Meta con confirmación
 */
export function DisconnectMetaButton() {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const handleDisconnect = () => {
    startTransition(async () => {
      try {
        const result = await disconnectMetaAccount();
        if (result.success) {
          toast({
            title: "Cuenta desconectada",
            description: "La cuenta de Meta ha sido desconectada exitosamente.",
          });
          setOpen(false);
          router.refresh();
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: result.error || "Error al desconectar la cuenta",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Error inesperado",
        });
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          className="gap-2"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Desconectando...</span>
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4" />
              <span>Desvincular Cuenta</span>
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Desvincular cuenta de Facebook?</AlertDialogTitle>
          <AlertDialogDescription>
            Esto desconectará la sincronización de todas las páginas hasta que te vuelvas a conectar.
            Esta acción eliminará todos los tokens de acceso almacenados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDisconnect}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Desconectando...
              </>
            ) : (
              "Desvincular"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

