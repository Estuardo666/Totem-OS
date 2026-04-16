"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFinanceOfflineState } from "@/components/features/finance/use-finance-offline-state";
import { CloudOff, RefreshCw } from "lucide-react";

export function FinanceOfflineNotice() {
  const { isOnline, pendingCount } = useFinanceOfflineState();

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <Alert className="mb-6 border-amber-500/30 bg-amber-500/5">
      {isOnline ? (
        <RefreshCw className="h-4 w-4 text-amber-600" />
      ) : (
        <CloudOff className="h-4 w-4 text-amber-600" />
      )}
      <AlertTitle>
        {isOnline ? "Sincronización pendiente" : "Modo offline activo"}
      </AlertTitle>
      <AlertDescription>
        {isOnline
          ? `Hay ${pendingCount} movimiento(s) financiero(s) pendiente(s) por sincronizar.`
          : `Puedes seguir registrando movimientos. ${pendingCount} operación(es) se enviarán cuando vuelva la conexión.`}
      </AlertDescription>
    </Alert>
  );
}