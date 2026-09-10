"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Unlink } from "lucide-react";
import { disconnectTikTokAccount } from "@/actions/tiktok-actions";
import { useToast } from "@/components/ui/use-toast";

/**
 * Desconecta TikTok. Pide confirmación porque también desvincula el perfil de
 * los clientes que lo usaban, y reconectar exige volver a autorizar en TikTok.
 */
export function DisconnectTikTokButton() {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDisconnect = () => {
    const confirmed = window.confirm(
      "Se eliminará la conexión con TikTok y se desvinculará de los clientes que la usen. " +
        "Las métricas ya guardadas se conservan. ¿Continuar?"
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await disconnectTikTokAccount();
      if (result.success) {
        toast({ title: "TikTok desconectado" });
        router.refresh();
        return;
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error || "No se pudo desconectar TikTok",
      });
    });
  };

  return (
    <Button onClick={handleDisconnect} disabled={isPending} variant="destructive" size="sm">
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Unlink className="mr-2 h-4 w-4" />
      )}
      Desconectar
    </Button>
  );
}
