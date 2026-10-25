"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title?: string;
  description?: string;
  showBackButton?: boolean;
  backHref?: string;
  className?: string;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

export function PageHeader({
  title,
  description,
  showBackButton = true,
  backHref,
  className,
  actions,
  breadcrumbs,
}: PageHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Auto-generar breadcrumbs si no se proporcionan
  const generatedBreadcrumbs = breadcrumbs || generateBreadcrumbs(pathname);

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <div className={cn("mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-2 pt-4 md:pt-6", className)}>
      <div className="flex min-w-0 items-center gap-2">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            aria-label="Ir atrás"
            className="-ml-2 h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex items-center truncate text-xs text-muted-foreground">
            {generatedBreadcrumbs.map((item, index) => (
              <div key={index} className="flex items-center">
                {index > 0 && <span className="mx-1.5 text-muted-foreground/60">/</span>}
                {item.href && index < generatedBreadcrumbs.length - 1 ? (
                  <Link
                    href={item.href}
                    className="hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className={index === generatedBreadcrumbs.length - 1 ? "text-foreground" : ""}>
                    {item.label}
                  </span>
                )}
              </div>
            ))}
          </nav>

          {/* Título y descripción */}
          {title && <h1 className="truncate text-2xl font-semibold">{title}</h1>}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// Función para generar breadcrumbs automáticamente basados en la ruta
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Inicio", href: "/" },
  ];

  const pathMap: Record<string, string> = {
    clients: "Clientes",
    content: "Content Factory",
    finance: "Finanzas",
    admin: "Administración",
    chronos: "Chronos",
    dashboard: "Dashboard",
    new: "Nuevo",
    shoots: "Rodajes",
    generator: "Generador IA",
    transactions: "Transacciones",
    "monthly-summary": "Resumen del Mes",
    "monthly-close": "Cierre Mensual",
    receivables: "Por Cobrar",
    settlement: "Liquidaciones",
    personal: "Personal",
    alerts: "Alertas",
    expenses: "Gastos",
    notifications: "Notificaciones",
    users: "Usuarios",
    settings: "Configuración",
    integrations: "Integraciones",
    reports: "Reportes",
  };

  let currentPath = "";
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // Si es un ID (UUID o número), usar "Detalle" en vez del ID
    if (segment.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) || !isNaN(Number(segment))) {
      breadcrumbs.push({
        label: "Detalle",
        href: index === segments.length - 1 ? undefined : currentPath,
      });
    } else {
      const label = pathMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
      breadcrumbs.push({
        label,
        href: index === segments.length - 1 ? undefined : currentPath,
      });
    }
  });

  return breadcrumbs;
}
