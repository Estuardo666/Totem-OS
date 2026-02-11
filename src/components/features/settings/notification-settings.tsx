"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { updateUserSettings } from "@/actions/user.actions";
import { useToast } from "@/components/ui/use-toast";
import { Bell, Volume2 } from "lucide-react";

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
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-pink-600">
            <Bell className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Notificaciones</h3>
            <p className="text-xs text-muted-foreground">Controla cómo recibes alertas</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="divide-y">
        {/* Sound Notifications Row */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600">
              <Volume2 className="h-4 w-4 text-white" />
            </div>
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

