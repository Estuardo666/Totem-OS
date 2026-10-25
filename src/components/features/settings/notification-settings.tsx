"use client";

import { useState, useTransition } from "react";
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

