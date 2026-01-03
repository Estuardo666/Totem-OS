"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { syncLegacySpecialties } from "@/actions/admin/specialty-actions";

export function SyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncLegacySpecialties();
      if (result.success) {
        toast({
          title: "Sincronización completada",
          description: `Se crearon ${result.data?.count} nuevas especialidades.`,
        });
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Error al sincronizar",
          description: result.error,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ocurrió un error inesperado",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleSync} disabled={isSyncing}>
      <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
      Sincronizar Legacy
    </Button>
  );
}

