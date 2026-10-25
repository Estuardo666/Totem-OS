// Layout del módulo de Facturación Electrónica

import { Metadata } from "next";
import { AppPageHeader } from "@/components/shared/app-page-header";
import { FacturacionNav } from "@/components/features/facturacion/facturacion-nav";

export const metadata: Metadata = {
  title: "Facturación Electrónica | Totem OS",
  description: "Gestión de facturación electrónica Ecuador - SRI",
};

export default function FacturacionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <AppPageHeader title="Facturación electrónica" description="Comprobantes electrónicos SRI Ecuador" />
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-6 pt-2">
        <FacturacionNav />
        <div>{children}</div>
      </div>
    </div>
  );
}
