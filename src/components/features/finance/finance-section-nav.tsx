"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookCheck, Plus, Receipt, Scale, TrendingDown } from "lucide-react";
import { TransactionDialog } from "@/components/features/finance/transaction-dialog";
import { Button } from "@/components/ui/button";
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
    href: "/finance/monthly-summary",
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
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;

        return (
          <Button
            key={item.href}
            variant={active ? "default" : "outline"}
            asChild
            className={cn(
              "rounded-full px-4 shadow-sm",
              active && "bg-foreground text-background hover:bg-foreground/90"
            )}
          >
            <Link href={item.href}>
              <Icon className="mr-2 h-4 w-4" />
              {item.label}
            </Link>
          </Button>
        );
      })}

      <TransactionDialog isAdminOverride={isAdmin}>
        <Button variant="outline" className="rounded-full px-4 shadow-sm">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Transacción
        </Button>
      </TransactionDialog>
    </div>
  );
}
