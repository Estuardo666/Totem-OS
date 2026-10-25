import { cn } from "@/lib/utils";

interface AppPageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Ancho del contenido; debe coincidir con el contenedor de la página. */
  maxWidth?: string;
  className?: string;
}

/**
 * Encabezado estándar de página, sin líneas ni iconos: la jerarquía la dan el
 * tamaño (H1 22px) y el espacio. En desktop su bloque de título queda centrado
 * a 48px del borde superior, igual que el logo del sidebar flotante.
 */
export function AppPageHeader({
  title,
  description,
  actions,
  maxWidth = "max-w-7xl",
  className,
}: AppPageHeaderProps) {
  return (
    <header
      data-page-header
      className={cn(
        "sticky top-0 z-40 bg-background/80 backdrop-blur-xl backdrop-saturate-150",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 pb-4 pt-4 md:pt-6",
          maxWidth
        )}
      >
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-foreground">{title}</h1>
          {description && (
            <p className="truncate text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
