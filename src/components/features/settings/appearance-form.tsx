"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/features/clients/color-picker";
import { updateUserSettings } from "@/actions/user.actions";
import { useToast } from "@/components/ui/use-toast";
import { Palette, Moon } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

const appearanceSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido"),
  darkMode: z.boolean(),
});

type AppearanceFormValues = z.infer<typeof appearanceSchema>;

interface AppearanceFormProps {
  primaryColor: string;
  darkMode: boolean;
}

export function AppearanceForm({ primaryColor: initialPrimaryColor, darkMode: initialDarkMode }: AppearanceFormProps) {
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor);
  const [darkMode, setDarkMode] = useState(initialDarkMode);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const { handleSubmit, setValue, watch } = useForm<AppearanceFormValues>({
    resolver: zodResolver(appearanceSchema),
    defaultValues: {
      primaryColor: initialPrimaryColor,
      darkMode: initialDarkMode,
    },
  });

  // Actualizar variable CSS en tiempo real cuando cambia el color (debounced)
  const debouncedColor = useDebounce(primaryColor, 300);

  useEffect(() => {
    if (debouncedColor && debouncedColor !== initialPrimaryColor) {
      const hexToHsl = (hex: string): string => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

          switch (max) {
            case r:
              h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
              break;
            case g:
              h = ((b - r) / d + 2) / 6;
              break;
            case b:
              h = ((r - g) / d + 4) / 6;
              break;
          }
        }

        h = Math.round(h * 360);
        s = Math.round(s * 100);
        const lPercent = Math.round(l * 100);

        return `${h} ${s}% ${lPercent}%`;
      };

      const hslColor = hexToHsl(debouncedColor);
      document.documentElement.style.setProperty("--primary", hslColor);
    }
  }, [debouncedColor, initialPrimaryColor]);

  // Sincronizar darkMode con la clase .dark en tiempo real
  useEffect(() => {
    const htmlElement = document.documentElement;
    if (darkMode) {
      htmlElement.classList.add("dark");
    } else {
      htmlElement.classList.remove("dark");
    }
  }, [darkMode]);

  const handleColorChange = useCallback((color: string) => {
    setPrimaryColor(color);
    setValue("primaryColor", color);
  }, [setValue]);

  const handleDarkModeToggle = (checked: boolean) => {
    // Optimistic update
    setDarkMode(checked);
    setValue("darkMode", checked);

    startTransition(async () => {
      const result = await updateUserSettings({ darkMode: checked });
      
      if (result.success) {
        toast({
          title: "Modo oscuro actualizado",
          description: checked 
            ? "El modo oscuro está activado" 
            : "El modo oscuro está desactivado",
        });
      } else {
        // Revert on error
        setDarkMode(!checked);
        setValue("darkMode", !checked);
        toast({
          title: "Error",
          description: result.error || "No se pudo actualizar el modo oscuro",
          variant: "destructive",
        });
      }
    });
  };

  const onSubmit = async (data: AppearanceFormValues) => {
    startTransition(async () => {
      const result = await updateUserSettings({
        primaryColor: data.primaryColor,
        darkMode: data.darkMode,
      });

      if (result.success) {
        toast({
          title: "Apariencia actualizada",
          description: "Tus preferencias de apariencia se han guardado correctamente",
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo actualizar la apariencia",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Apariencia</CardTitle>
        </div>
        <CardDescription>
          Personaliza el color principal y el modo oscuro
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Modo Oscuro */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="dark-mode" className="text-base">
                  Modo oscuro
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Activa el tema oscuro para una mejor experiencia visual
              </p>
            </div>
            <Switch
              id="dark-mode"
              checked={darkMode}
              onCheckedChange={handleDarkModeToggle}
              disabled={isPending}
            />
          </div>

          {/* Color Principal */}
          <div className="space-y-2">
            <Label htmlFor="primary-color">Color principal</Label>
            <p className="text-sm text-muted-foreground">
              Selecciona el color principal de la interfaz
            </p>
            <ColorPicker
              value={primaryColor}
              onChange={handleColorChange}
              disabled={isPending}
            />
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

