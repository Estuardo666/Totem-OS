"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Facebook, Loader2 } from "lucide-react";
import { getMetaAuthUrl } from "@/actions/meta-actions";
import { useToast } from "@/components/ui/use-toast";

export function ConnectMetaButton() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleConnect = () => {
    startTransition(async () => {
      try {
        const result = await getMetaAuthUrl();
        if (result.success && result.data) {
          window.location.href = result.data.url;
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: result.error || "Error al generar URL de autorización",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Error inesperado al generar URL de autorización",
        });
      }
    });
  };

  return (
    <Button onClick={handleConnect} size="lg" className="w-full sm:w-auto" disabled={isPending}>
      {isPending ? (
        <>
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          Cargando...
        </>
      ) : (
        <>
          <Facebook className="h-5 w-5 mr-2" />
          Conectar con Facebook
        </>
      )}
    </Button>
  );
}

