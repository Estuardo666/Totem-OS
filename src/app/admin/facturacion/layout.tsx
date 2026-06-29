// Layout del módulo de Facturación Electrónica

import { Metadata } from "next";
import Link from "next/link";
import { Receipt, Settings, FileText, Package, BarChart3 } from "lucide-react";

export const metadata: Metadata = {
  title: "Facturación Electrónica | Totem OS",
  description: "Gestión de facturación electrónica Ecuador - SRI",
};

const navItems = [
  { href: "/admin/facturacion", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/facturacion/facturas", label: "Facturas", icon: FileText },
  { href: "/admin/facturacion/productos", label: "Productos", icon: Package },
  { href: "/admin/facturacion/configuracion", label: "Configuración", icon: Settings },
];

export default function FacturacionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Receipt className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facturación Electrónica</h1>
          <p className="text-sm text-muted-foreground">
            Comprobantes electrónicos SRI Ecuador
          </p>
        </div>
      </div>

      <nav className="flex gap-1 border-b pb-px">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-primary"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <main>{children}</main>
    </div>
  );
}
