"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { segmentedTrack, segmentedItemClass } from "@/components/ui/segmented";

export interface SettingsPanel {
  id: string;
  label: string;
  description: string;
  /** Agrupa la navegación (Personal / Organización). */
  group: string;
  content: React.ReactNode;
}

/**
 * Configuración al estilo de "Ajustes del sistema": navegación de secciones a
 * la izquierda y un único panel a la derecha. Todos los paneles quedan
 * montados (los formularios conservan su estado al cambiar de sección) y la
 * sección activa vive en ?section= para poder enlazarla directamente.
 */
export function SettingsShell({ panels }: { panels: SettingsPanel[] }) {
  const [active, setActive] = useState(panels[0]?.id);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("section");
    if (requested && panels.some((panel) => panel.id === requested)) setActive(requested);
  }, [panels]);

  const select = (id: string) => {
    setActive(id);
    const url = new URL(window.location.href);
    url.searchParams.set("section", id);
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0 });
  };

  const groups = panels.reduce<Record<string, SettingsPanel[]>>((acc, panel) => {
    (acc[panel.group] ??= []).push(panel);
    return acc;
  }, {});

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-10 pt-2 md:grid-cols-[13.5rem_minmax(0,1fr)] md:gap-10">
      {/* Móvil: selector horizontal */}
      <nav aria-label="Secciones de configuración" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:hidden">
        <div className={cn(segmentedTrack, "w-max")}>
          {panels.map((panel) => (
            <button
              key={panel.id}
              type="button"
              data-pressable=""
              aria-current={active === panel.id ? "page" : undefined}
              onClick={() => select(panel.id)}
              className={segmentedItemClass(active === panel.id)}
            >
              {panel.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Desktop: lista agrupada, fija al hacer scroll */}
      <nav aria-label="Secciones de configuración" className="hidden md:block">
        <div className="sticky top-28 space-y-6">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <p className="mb-1.5 px-3 text-xs font-medium text-muted-foreground">{group}</p>
              <ul className="space-y-0.5">
                {items.map((panel) => (
                  <li key={panel.id}>
                    <button
                      type="button"
                      aria-current={active === panel.id ? "page" : undefined}
                      onClick={() => select(panel.id)}
                      className={cn(
                        "flex h-9 w-full items-center rounded-full px-3.5 text-left text-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active === panel.id
                          ? "bg-primary/[0.1] font-medium text-foreground"
                          : "text-foreground/70 hover:bg-primary/[0.1] hover:text-foreground"
                      )}
                    >
                      {panel.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="min-w-0">
        {panels.map((panel) => (
          <section
            key={panel.id}
            hidden={active !== panel.id}
            aria-labelledby={`settings-${panel.id}`}
            className="settings-panel space-y-5"
          >
            <div className="max-w-2xl">
              <h2 id={`settings-${panel.id}`} className="text-xl font-semibold">{panel.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{panel.description}</p>
            </div>
            <div className="space-y-4">{panel.content}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
