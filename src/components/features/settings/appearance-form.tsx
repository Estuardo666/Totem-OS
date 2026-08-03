"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { updateUserSettings } from "@/actions/user.actions";
import { ColorPicker } from "@/components/features/clients/color-picker";
import { useToast } from "@/components/ui/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import {
  applyThemeToDocument,
  CATPPUCCIN_ACCENTS,
  CATPPUCCIN_PALETTES,
  DEFAULT_CATPPUCCIN_ACCENT,
  isCatppuccinAccent,
  persistThemeClient,
  type CatppuccinAccent,
  type ThemeId,
  type ThemeSelection,
  type ThemeVariant,
} from "@/lib/theme";
import { Check, Moon, Palette, Sun } from "lucide-react";

const ACCENT_LABELS: Record<CatppuccinAccent, string> = {
  rosewater: "Rosewater", flamingo: "Flamingo", pink: "Pink", mauve: "Mauve",
  red: "Red", maroon: "Maroon", peach: "Peach", yellow: "Yellow", green: "Green",
  teal: "Teal", sky: "Sky", sapphire: "Sapphire", blue: "Blue", lavender: "Lavender",
};

interface AppearanceFormProps {
  primaryColor: string;
  darkMode: boolean;
  themeId: ThemeId;
  catppuccinAccent: string;
}

export function AppearanceForm({ primaryColor: initialPrimaryColor, darkMode, themeId, catppuccinAccent }: AppearanceFormProps) {
  const [selection, setSelection] = useState<ThemeSelection>({
    themeId,
    variant: darkMode ? "dark" : "light",
    primaryColor: initialPrimaryColor,
    catppuccinAccent: isCatppuccinAccent(catppuccinAccent) ? catppuccinAccent : DEFAULT_CATPPUCCIN_ACCENT,
  });
  const [isPending, startTransition] = useTransition();
  const persistedColor = useRef(initialPrimaryColor);
  const debouncedColor = useDebounce(selection.primaryColor, 350);
  const { toast } = useToast();

  const applySelection = useCallback((next: ThemeSelection) => {
    setSelection(next);
    applyThemeToDocument(next);
    persistThemeClient(next);
  }, []);

  const saveImmediate = useCallback((next: ThemeSelection, changes: Record<string, unknown>) => {
    const previous = selection;
    applySelection(next);
    startTransition(async () => {
      const result = await updateUserSettings(changes);
      if (!result.success) {
        applySelection(previous);
        toast({ title: "No se pudo cambiar el tema", description: result.error, variant: "destructive" });
      }
    });
  }, [applySelection, selection, toast]);

  useEffect(() => {
    if (debouncedColor === persistedColor.current) return;
    persistedColor.current = debouncedColor;
    startTransition(async () => {
      const result = await updateUserSettings({ primaryColor: debouncedColor });
      if (!result.success) toast({ title: "No se pudo guardar el color", description: result.error, variant: "destructive" });
    });
  }, [debouncedColor, toast]);

  const chooseTheme = (nextThemeId: ThemeId) => saveImmediate({ ...selection, themeId: nextThemeId }, { themeId: nextThemeId });
  const chooseVariant = (variant: ThemeVariant) => saveImmediate({ ...selection, variant }, { darkMode: variant === "dark" });
  const chooseAccent = (accent: CatppuccinAccent) => saveImmediate({ ...selection, catppuccinAccent: accent }, { catppuccinAccent: accent });
  const changePrimaryColor = (color: string) => applySelection({ ...selection, primaryColor: color });
  const flavor = selection.variant === "dark" ? "Mocha" : "Latte";

  return (
    <div className="rounded-xl border bg-card overflow-hidden sm:col-span-2">
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600"><Palette className="h-4 w-4 text-white" /></div>
          <div><h3 className="text-sm font-medium">Apariencia</h3><p className="text-xs text-muted-foreground">Elige una familia, variante y color de acento</p></div>
        </div>
      </div>

      <div className="p-3 space-y-3">
        <fieldset disabled={isPending}>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tema</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Familia de tema">
            <ThemePreview title="Actual" subtitle="Estilo original" selected={selection.themeId === "default"} onClick={() => chooseTheme("default")} colors={["#ffffff", "#27221f", selection.primaryColor]} />
            <ThemePreview title="Catppuccin" subtitle={flavor} selected={selection.themeId === "catppuccin"} onClick={() => chooseTheme("catppuccin")} colors={[CATPPUCCIN_PALETTES[selection.variant].base, CATPPUCCIN_PALETTES[selection.variant].surface0, CATPPUCCIN_PALETTES[selection.variant][selection.catppuccinAccent]]} />
          </div>
        </fieldset>

        <fieldset disabled={isPending}>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Variante</legend>
          <div className="grid max-w-sm grid-cols-2 rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Variante clara u oscura">
            {(["light", "dark"] as const).map((variant) => {
              const active = selection.variant === variant;
              const Icon = variant === "light" ? Sun : Moon;
              return <button key={variant} type="button" role="radio" aria-checked={active} onClick={() => chooseVariant(variant)} className={cn("flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}><Icon className="h-3.5 w-3.5" />{variant === "light" ? "Light" : "Dark"}</button>;
            })}
          </div>
        </fieldset>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Color de acento</p>
          {selection.themeId === "default" ? (
            <><p className="mb-3 text-xs text-muted-foreground">Color libre para las variantes actuales.</p><ColorPicker value={selection.primaryColor} onChange={changePrimaryColor} disabled={isPending} /></>
          ) : (
            <><p className="mb-2 text-xs text-muted-foreground">Paleta oficial Catppuccin {flavor}. Seleccionado: {ACCENT_LABELS[selection.catppuccinAccent]}.</p>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Acento Catppuccin">
                {CATPPUCCIN_ACCENTS.map((accent) => { const active = accent === selection.catppuccinAccent; return <button key={accent} type="button" role="radio" aria-checked={active} title={ACCENT_LABELS[accent]} aria-label={ACCENT_LABELS[accent]} disabled={isPending} onClick={() => chooseAccent(accent)} className={cn("relative h-5 w-5 shrink-0 rounded-full border transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1", active ? "border-foreground ring-1 ring-foreground/40" : "border-transparent")} style={{ backgroundColor: CATPPUCCIN_PALETTES[selection.variant][accent] }}>{active && <Check className="absolute inset-0 m-auto h-2.5 w-2.5 text-[hsl(var(--primary-foreground))] drop-shadow" />}</button>; })}
              </div></>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground" aria-live="polite">{isPending ? "Guardando preferencia…" : "Los cambios se aplican y guardan automáticamente."}</p>
      </div>
    </div>
  );
}

function ThemePreview({ title, subtitle, selected, onClick, colors }: { title: string; subtitle: string; selected: boolean; onClick: () => void; colors: string[] }) {
  return <button type="button" role="radio" aria-checked={selected} onClick={onClick} className={cn("rounded-lg border p-1.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected ? "border-primary bg-primary/5 ring-1 ring-primary/40" : "border-border hover:border-primary/50")}>
    <span className="mb-1.5 flex h-6 overflow-hidden rounded border">{colors.map((color, index) => <span key={color + index} className="flex-1" style={{ backgroundColor: color }} />)}</span>
    <span className="flex items-center justify-between gap-1"><span className="min-w-0"><span className="block truncate text-xs font-medium">{title}</span><span className="block truncate text-[10px] leading-3 text-muted-foreground">{subtitle}</span></span>{selected && <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-2.5 w-2.5" /></span>}</span>
  </button>;
}
