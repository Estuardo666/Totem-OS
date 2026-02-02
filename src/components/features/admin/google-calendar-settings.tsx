"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
      setError("No se pudo verificar el estado de Google Calendar");
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
      setError("No se pudo desconectar Google Calendar");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>Google Calendar</span>
        </CardTitle>
        <CardDescription>
          Conecta tu Google Calendar para crear eventos automáticamente y sincronizar con el cliente y el equipo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-between gap-3 p-3 border rounded-lg">
          <div className="text-sm">
            {isConnected ? "Tu calendario está conectado." : "Tu calendario aún no está conectado."}
          </div>
          {isConnected === null ? (
            <Badge variant="secondary" className="text-xs">
              Verificando...
            </Badge>
          ) : isConnected ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Conectado
              </Badge>
              <Button type="button" variant="outline" size="sm" onClick={handleDisconnect} disabled={isLoading}>
                Desconectar
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={handleConnect} disabled={isLoading}>
              Conectar Calendar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
