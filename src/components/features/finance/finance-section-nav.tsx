"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookCheck, Receipt, Scale, TrendingDown, PiggyBank, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

type FinanceSectionNavProps = {
  userRole?: string;
  className?: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof BarChart3;
  adminOnly?: boolean;
  hideForEditor?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/finance",
    label: "Resumen del Mes",
    icon: BarChart3,
    adminOnly: true,
  },
  {
    href: "/finance/receivables",
    label: "Cuentas por Cobrar",
    icon: Receipt,
    adminOnly: true,
  },
  {
    href: "/finance/monthly-close",
    label: "Cierre Mensual",
    icon: BookCheck,
    adminOnly: true,
  },
  {
    href: "/finance/expenses",
    label: "Gastos y Egresos",
    icon: TrendingDown,
    hideForEditor: true,
  },
  {
    href: "/finance/settlement",
    label: "Liquidación Interna",
    icon: Scale,
    adminOnly: true,
  },
  {
    href: "/finance/profits",
    label: "Utilidades",
    icon: PiggyBank,
    adminOnly: true,
  },
  {
    href: "/finance/emergency-fund",
    label: "Fondo de Emergencia",
    icon: Shield,
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
    <nav aria-label="Secciones de Finanzas" className={cn("flex min-w-0 snap-x snap-mandatory gap-1 overflow-x-auto scrollbar-hide rounded-xl border border-border/80 bg-card p-1 shadow-[0_8px_24px_rgba(15,23,42,0.025)] md:grid md:grid-cols-4 md:overflow-visible xl:grid-cols-7", className)}>
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href === "/finance" && pathname === "/finance/monthly-summary");

        return (
          <Link
            key={item.href}
            className={cn(
              "inline-flex h-9 min-w-[136px] shrink-0 snap-start items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:min-w-0 md:px-2 xl:text-[11px]",
              active && "bg-muted font-semibold text-foreground shadow-sm ring-1 ring-border/70 hover:bg-accent hover:text-foreground"
            )}
            href={item.href}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
