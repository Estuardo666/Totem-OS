"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { resyncPageTokens } from "@/actions/meta-actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

/**
 * Vuelve a emitir los tokens de página de todos los clientes vinculados.
 *
 * Sin diálogo de confirmación: la acción es idempotente y no destruye nada —
 * reescribe cada token con uno recién pedido, y a los clientes que no aparecen
 * los deja como estaban.
 *
 * Se muestra en los dos modos. Con un usuario del sistema es la forma de
 * aplicar una asignación hecha en Business Manager sin esperar al cron; con
 * OAuth sirve igual para recuperar un token de página caducado.
 */
export function ResyncPageTokensButton() {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleResync = () => {
    startTransition(async () => {
      const result = await resyncPageTokens();

      if (!result.success || !result.data) {
        toast({
          variant: "destructive",
          title: "No se pudo resincronizar",
          description: result.error,
        });
        return;
      }

      const { updated, unmatched } = result.data;

      toast({
        title:
          updated === 1
            ? "1 token de página actualizado"
            : `${updated} tokens de página actualizados`,
      });

      // Un cliente sin página entre las gestionadas casi siempre significa que
      // falta asignarle el activo en Business Manager. Se nombra para que sea
      // accionable en vez de un número suelto.
      if (unmatched.length > 0) {
        toast({
          variant: "destructive",
          title: `${unmatched.length} sin acceso a su página`,
          description: `${unmatched.join(", ")}. Revisa que el activo esté asignado en Business Manager.`,
        });
      }

      router.refresh();
    });
  };

  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={handleResync} disabled={isPending}>
      {isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Resincronizando...</span>
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4" />
          <span>Resincronizar tokens</span>
        </>
      )}
    </Button>
  );
}
