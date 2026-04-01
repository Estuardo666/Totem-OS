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
    <div className={cn("mb-8 space-y-4", className)}>
      {/* Top row: Back Button y Actions (en esquina opuesta) */}
      <div className="flex items-center justify-between">
        <div>
          {/* Botón Ir atrás */}
          {showBackButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="text-muted-foreground hover:text-foreground -ml-2 h-8"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Ir atrás
            </Button>
          )}
        </div>
        {/* Actions en la esquina superior derecha */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center text-sm text-muted-foreground">
        {generatedBreadcrumbs.map((item, index) => (
          <div key={index} className="flex items-center">
            {index > 0 && <span className="mx-2">/</span>}
            {item.href && index < generatedBreadcrumbs.length - 1 ? (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={index === generatedBreadcrumbs.length - 1 ? "text-foreground font-medium" : ""}>
                {item.label}
              </span>
            )}
          </div>
        ))}
      </nav>

      {/* Título y descripción */}
      {(title || description) && (
        <div className="space-y-1">
          {title && <h1 className="text-3xl font-bold tracking-tight">{title}</h1>}
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
      )}
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
