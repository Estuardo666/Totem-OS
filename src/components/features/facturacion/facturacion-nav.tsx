"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { segmentedTrack, segmentedItemClass } from "@/components/ui/segmented";

const NAV_ITEMS = [
  { href: "/admin/facturacion", label: "Dashboard" },
  { href: "/admin/facturacion/facturas", label: "Facturas" },
  { href: "/admin/facturacion/productos", label: "Productos" },
  { href: "/admin/facturacion/configuracion", label: "Configuración" },
];

export function FacturacionNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones de Facturación" className={cn(segmentedTrack, "max-w-full overflow-x-auto [scrollbar-width:none]")}>
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/admin/facturacion"
            ? pathname === item.href
            : pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={segmentedItemClass(active)}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
