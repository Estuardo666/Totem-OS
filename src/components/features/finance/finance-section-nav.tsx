"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { segmentedTrack, segmentedItemClass } from "@/components/ui/segmented";

type FinanceSectionNavProps = {
  userRole?: string;
  className?: string;
};

type NavItem = {
  href: string;
  label: string;
  adminOnly?: boolean;
  hideForEditor?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/finance",
    label: "Resumen del Mes",
    adminOnly: true,
  },
  {
    href: "/finance/receivables",
    label: "Cuentas por Cobrar",
    adminOnly: true,
  },
  {
    href: "/finance/monthly-close",
    label: "Cierre Mensual",
    adminOnly: true,
  },
  {
    href: "/finance/expenses",
    label: "Gastos y Egresos",
    hideForEditor: true,
  },
  {
    href: "/finance/settlement",
    label: "Liquidación Interna",
    adminOnly: true,
  },
  {
    href: "/finance/profits",
    label: "Reparto de utilidades",
    adminOnly: true,
  },
  {
    href: "/finance/utilidades",
    label: "Utilidades acumuladas",
    adminOnly: true,
  },
];

export function FinanceSectionNav({ userRole, className }: FinanceSectionNavProps) {
  const pathname = usePathname();
  const isAdmin = userRole === "ADMIN";
  const isEditor = userRole === "EDITOR";

  const items = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.hideForEditor && isEditor) return false;
    return true;
  });

  return (
    <nav aria-label="Secciones de Finanzas" className={cn(segmentedTrack, "flex w-full min-w-0 snap-x snap-mandatory overflow-x-auto scrollbar-hide", className)}>
      {items.map((item) => {
        const active = pathname === item.href || (item.href === "/finance" && pathname === "/finance/monthly-summary");

        return (
          <Link
            key={item.href}
            className={segmentedItemClass(active, "shrink-0 snap-start xl:flex-1")}
            href={item.href}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
