"use client";

import { useEffect, useState } from "react";
import { Calendar, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function GoogleCalendarSettings() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setError(null);
      const response = await fetch("/api/google-calendar/status");
      const data = await response.json();
      setIsConnected(Boolean(data.connected));
    } catch (fetchError) {
      console.error("Error verificando Google Calendar:", fetchError);
      setError("No se pudo verificar el estado");
      setIsConnected(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, []);

  const handleConnect = () => {
    setIsLoading(true);
    window.location.href = "/api/auth/google";
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/google-calendar/disconnect", { method: "POST" });
      if (!response.ok) {
        throw new Error("No se pudo desconectar Google Calendar");
      }
      setIsConnected(false);
    } catch (disconnectError) {
      console.error("Error desconectando Google Calendar:", disconnectError);
      setError("No se pudo desconectar");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600">
            <Calendar className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Google Calendar</h3>
            <p className="text-xs text-muted-foreground">Sincroniza eventos automáticamente</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="divide-y">
        {/* Connection Status Row */}
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {isConnected === null ? (
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : isConnected ? (
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
            ) : (
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-yellow-500/10">
                <XCircle className="h-4 w-4 text-yellow-600" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {isConnected === null 
                  ? "Verificando conexión..." 
                  : isConnected 
                    ? "Calendario conectado" 
                    : "Sin conexión"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {error 
                  ? error 
                  : isConnected 
                    ? "Los eventos se sincronizan automáticamente" 
                    : "Conecta para crear eventos automáticamente"}
              </p>
            </div>
          </div>
          
          <div className="shrink-0">
            {isConnected === null ? (
              <Badge variant="secondary" className="text-xs">
                Verificando...
              </Badge>
            ) : isConnected ? (
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={handleDisconnect} 
                disabled={isLoading}
                className="h-8"
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Desconectar"
                )}
              </Button>
            ) : (
              <Button 
                type="button" 
                size="sm" 
                onClick={handleConnect} 
                disabled={isLoading}
                className="h-8"
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Conectar"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
