"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Music2 } from "lucide-react";
import { getTikTokAuthUrl } from "@/actions/tiktok-actions";
import { useToast } from "@/components/ui/use-toast";

interface ConnectTikTokButtonProps {
  label?: string;
}

export function ConnectTikTokButton({ label = "Conectar con TikTok" }: ConnectTikTokButtonProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleConnect = () => {
    startTransition(async () => {
      const result = await getTikTokAuthUrl();
      if (result.success && result.data) {
        window.location.href = result.data.url;
        return;
      }
      toast({
        variant: "destructive",
        title: "No se pudo iniciar la conexión",
        description: result.error || "Error al generar la URL de autorización",
      });
    });
  };

  return (
    <Button onClick={handleConnect} disabled={isPending} className="w-full sm:w-auto">
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Cargando...
        </>
      ) : (
        <>
          <Music2 className="mr-2 h-4 w-4" />
          {label}
        </>
      )}
    </Button>
  );
}
