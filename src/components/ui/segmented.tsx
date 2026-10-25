// Sin "use client": las clases se usan también desde componentes de servidor.
import { cn } from "@/lib/utils";

/**
 * Estilo único para pestañas, controles segmentados y barras de navegación
 * internas: pista tintada con el color del usuario y segmento activo elevado.
 * Tabs (Radix), Segmented y las navs internas comparten estas clases.
 */
export const segmentedTrack =
  "inline-flex items-center gap-0.5 rounded-full bg-primary/[0.07] p-1";

export const segmentedItem =
  "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-medium outline-none transition-[color,background-color,box-shadow] duration-260 ease-soft focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50";

export const segmentedItemIdle = "text-muted-foreground hover:bg-primary/[0.12] hover:text-foreground";

export const segmentedItemActive = "bg-popover text-foreground shadow-[0_1px_3px_rgba(16,16,20,0.12)]";

export function segmentedItemClass(active: boolean, className?: string) {
  return cn(segmentedItem, active ? segmentedItemActive : segmentedItemIdle, className);
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; count?: number }[];
  className?: string;
  /** Ocupa todo el ancho y reparte los segmentos por igual. */
  stretch?: boolean;
}

export function Segmented<T extends string>({ label, value, onChange, options, className, stretch }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(segmentedTrack, "max-w-full overflow-x-auto [scrollbar-width:none]", stretch && "flex w-full", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-pressable=""
            onClick={() => onChange(option.value)}
            className={segmentedItemClass(active, stretch ? "flex-1" : undefined)}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="text-xs tabular-nums text-muted-foreground">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
