"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Paleta de 34 colores vibrantes basados en Tailwind + colores de marca
const COLOR_PALETTE = [
  // Marca
  "#27221F", // INK
  "#A8E635", // Verde Fosforescente
  // Rojos y Rosas
  "#ef4444", // red-500
  "#f97316", // orange-500
  "#f59e0b", // amber-500
  "#eab308", // yellow-500
  // Verdes
  "#22c55e", // green-500
  "#10b981", // emerald-500
  "#14b8a6", // teal-500
  "#06b6d4", // cyan-500
  // Azules
  "#3b82f6", // blue-500
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#a855f7", // purple-500
  // Púrpuras y Magentas
  "#d946ef", // fuchsia-500
  "#ec4899", // pink-500
  "#f43f5e", // rose-500
  "#dc2626", // red-600
  // Tonos más oscuros
  "#ea580c", // orange-600
  "#d97706", // amber-600
  "#ca8a04", // yellow-600
  "#16a34a", // green-600
  "#059669", // emerald-600
  "#0d9488", // teal-600
  "#0891b2", // cyan-600
  "#2563eb", // blue-600
  "#4f46e5", // indigo-600
  "#7c3aed", // violet-600
  "#9333ea", // purple-600
  "#c026d3", // fuchsia-600
  "#db2777", // pink-600
  "#e11d48", // rose-600
  "#991b1b", // red-700
  "#c2410c", // orange-700
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

/**
 * Paleta en una sola fila desplazable (carrusel) con flechas a los lados.
 * Las flechas se ocultan cuando no hay más colores en esa dirección.
 */
export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const updateEdges = () => {
    const el = trackRef.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  };

  useEffect(() => {
    updateEdges();
    // Lleva el color seleccionado a la vista al abrir.
    const selected = trackRef.current?.querySelector<HTMLElement>("[aria-pressed='true']");
    selected?.scrollIntoView({ block: "nearest", inline: "center" });
  }, []);

  const scrollBy = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <ArrowButton label="Colores anteriores" hidden={edges.start} onClick={() => scrollBy(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </ArrowButton>
        <div
          ref={trackRef}
          onScroll={updateEdges}
          className="flex flex-1 snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-1 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {COLOR_PALETTE.map((color) => {
            const selected = value?.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={color}
                type="button"
                onClick={() => !disabled && onChange(color)}
                disabled={disabled}
                aria-pressed={selected}
                aria-label={`Seleccionar color ${color}`}
                data-pressable=""
                className={cn(
                  "h-8 w-8 shrink-0 snap-start rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50",
                  selected && "ring-2 ring-foreground ring-offset-2 ring-offset-popover"
                )}
                style={{ backgroundColor: color }}
              />
            );
          })}
        </div>
        <ArrowButton label="Más colores" hidden={edges.end} onClick={() => scrollBy(1)}>
          <ChevronRight className="h-4 w-4" />
        </ArrowButton>
      </div>
      {value && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: value }} aria-hidden />
          <span className="font-mono uppercase">{value}</span>
        </p>
      )}
    </div>
  );
}

function ArrowButton({ label, hidden, onClick, children }: { label: string; hidden: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      tabIndex={hidden ? -1 : 0}
      data-pressable=""
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/[0.08] text-foreground hover:bg-primary/[0.18]",
        hidden && "pointer-events-none opacity-0"
      )}
    >
      {children}
    </button>
  );
}
