"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { repairWebPushNotifications } from "@/components/providers/web-push-provider";
import { isTotemIOSAppUserAgent } from "@/lib/totem-ios-client";
import { Switch } from "@/components/ui/switch";
import { updateUserSettings } from "@/actions/user.actions";
import { useToast } from "@/components/ui/use-toast";

interface NotificationSettingsProps {
  soundNotifications: boolean;
}

export function NotificationSettings({ soundNotifications: initialValue }: NotificationSettingsProps) {
  const [soundNotifications, setSoundNotifications] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [canRepair, setCanRepair] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [pushStatus, setPushStatus] = useState("");
  useEffect(() => {
    if (isTotemIOSAppUserAgent()) return;
    if (typeof Notification === "undefined" || !("PushManager" in window)) {
      setPushStatus("Este navegador no admite Web Push. En iPhone abre la versión web desde su icono en la pantalla de inicio.");
      return;
    }
    setCanRepair(true);
    setPushStatus(Notification.permission === "granted" ? "Notificaciones permitidas en este navegador."
      : Notification.permission === "denied" ? "Permiso bloqueado. Actívalo en los ajustes de este sitio antes de renovar."
        : "Activa las notificaciones para este navegador.");
  }, []);

  const handleRepair = async () => {
    setRepairing(true);
    try {
      const success = await repairWebPushNotifications();
      setPushStatus(success ? "Registro renovado. Ya puedes enviar una prueba a tu usuario."
        : "No se pudo renovar. Comprueba el permiso del sitio y las notificaciones del navegador en el sistema.");
    } catch {
      setPushStatus("No se pudo renovar. Revisa la conexión y vuelve a intentarlo.");
    } finally { setRepairing(false); }
  };

  const handleToggle = (checked: boolean) => {
    setSoundNotifications(checked);

    startTransition(async () => {
      const result = await updateUserSettings({ soundNotifications: checked });
      
      if (result.success) {
        toast({
          title: "Configuración actualizada",
          description: checked 
            ? "Las notificaciones de sonido están activadas" 
            : "Las notificaciones de sonido están desactivadas",
        });
      } else {
        setSoundNotifications(!checked);
        toast({
          title: "Error",
          description: result.error || "No se pudo actualizar la configuración",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="rounded-2xl bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-1">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="text-base font-semibold">Sonido</h3>
            <p className="text-xs text-muted-foreground">Alertas dentro de la app</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="divide-y">
        {pushStatus && <div className="px-5 py-3 space-y-2">
          <p className="text-sm font-medium">Notificaciones de este dispositivo</p>
          <p role="status" className="text-xs text-muted-foreground">{pushStatus}</p>
          {canRepair && <Button variant="outline" size="sm" disabled={repairing} onClick={handleRepair}>
            {repairing ? "Renovando…" : "Renovar notificaciones"}
          </Button>}
        </div>}
        {/* Sound Notifications Row */}
        <div className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-primary/[0.1] transition-colors">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-medium">Sonidos</p>
              <p className="text-xs text-muted-foreground">Reproduce sonido con cada notificación</p>
            </div>
          </div>
          <Switch
            id="sound-notifications"
            checked={soundNotifications}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
        </div>
      </div>
    </div>
  );
}

