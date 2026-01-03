"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { fixUserRoles } from "@/actions/admin/user-actions";

export function FixRolesButton() {
  const [isFixing, setIsFixing] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleFix = async () => {
    if (!confirm("¿Estás seguro de corregir los roles inválidos a 'EDITOR'? Esto afectará a los usuarios con roles incorrectos.")) {
      return;
    }

    setIsFixing(true);
    try {
      const result = await fixUserRoles();
      if (result.success) {
        toast({
          title: "Corrección completada",
          description: `Se actualizaron ${result.data?.updated} usuarios.`,
        });
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Error al corregir",
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
      setIsFixing(false);
    }
  };

  return (
    <Button variant="destructive" onClick={handleFix} disabled={isFixing}>
      <AlertTriangle className={`h-4 w-4 mr-2 ${isFixing ? "animate-spin" : ""}`} />
      Corregir Roles
    </Button>
  );
}

