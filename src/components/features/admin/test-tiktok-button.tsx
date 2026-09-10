"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, PlugZap } from "lucide-react";
import { testTikTokConnection } from "@/actions/tiktok-actions";
import { useToast } from "@/components/ui/use-toast";

/**
 * Consulta la API real de TikTok en el momento.
 * Evita descubrir un problema de configuración recién en la corrida nocturna.
 */
export function TestTikTokButton() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleTest = () => {
    startTransition(async () => {
      const result = await testTikTokConnection();
      if (result.success && result.data) {
        const { displayName, followers, videos, likes } = result.data;
        toast({
          title: `Conexión correcta: ${displayName}`,
          description: `${followers} seguidores · ${videos} videos · ${likes} me gusta`,
        });
        return;
      }
      toast({
        variant: "destructive",
        title: "La conexión falló",
        description: result.error || "No se pudo consultar la API de TikTok",
      });
    });
  };

  return (
    <Button onClick={handleTest} disabled={isPending} variant="outline" size="sm">
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <PlugZap className="mr-2 h-4 w-4" />
      )}
      Probar conexión
    </Button>
  );
}
