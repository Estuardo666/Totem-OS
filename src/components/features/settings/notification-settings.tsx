"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { updateUserSettings } from "@/actions/user.actions";
import { useToast } from "@/components/ui/use-toast";
import { Bell } from "lucide-react";

interface NotificationSettingsProps {
  soundNotifications: boolean;
}

export function NotificationSettings({ soundNotifications: initialValue }: NotificationSettingsProps) {
  const [soundNotifications, setSoundNotifications] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleToggle = (checked: boolean) => {
    // Optimistic update
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
        // Revert on error
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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Notificaciones</CardTitle>
        </div>
        <CardDescription>
          Controla las notificaciones de sonido
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="sound-notifications" className="text-base">
              Sonido de notificaciones
            </Label>
            <p className="text-sm text-muted-foreground">
              Reproducir un sonido cuando recibas una notificación
            </p>
          </div>
          <Switch
            id="sound-notifications"
            checked={soundNotifications}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
        </div>
      </CardContent>
    </Card>
  );
}

