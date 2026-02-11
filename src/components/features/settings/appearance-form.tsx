"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/features/clients/color-picker";
import { updateUserSettings } from "@/actions/user.actions";
import { useToast } from "@/components/ui/use-toast";
import { Moon, Palette, Check } from "lucide-react";
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

  const { handleSubmit, setValue } = useForm<AppearanceFormValues>({
    resolver: zodResolver(appearanceSchema),
    defaultValues: {
      primaryColor: initialPrimaryColor,
      darkMode: initialDarkMode,
    },
  });

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
          description: "Tus preferencias se han guardado",
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
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
            <Palette className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Apariencia</h3>
            <p className="text-xs text-muted-foreground">Personaliza el estilo visual</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="divide-y">
          {/* Dark Mode Row */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900">
                <Moon className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">Modo oscuro</p>
                <p className="text-xs text-muted-foreground">Reduce el brillo de la pantalla</p>
              </div>
            </div>
            <Switch
              id="dark-mode"
              checked={darkMode}
              onCheckedChange={handleDarkModeToggle}
              disabled={isPending}
            />
          </div>

          {/* Primary Color Row */}
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center gap-3">
              <div 
                className="w-8 h-8 rounded-lg border-2 border-white shadow-sm"
                style={{ backgroundColor: primaryColor }}
              />
              <div>
                <p className="text-sm font-medium">Color principal</p>
                <p className="text-xs text-muted-foreground">Personaliza el color de acento</p>
              </div>
            </div>
            <ColorPicker
              value={primaryColor}
              onChange={handleColorChange}
              disabled={isPending}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t bg-muted/30">
          <Button 
            type="submit" 
            disabled={isPending} 
            size="sm" 
            className="w-full"
          >
            {isPending ? (
              "Guardando..."
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Guardar cambios
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

