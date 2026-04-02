"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/shared/sidebar";
import { Navbar } from "@/components/shared/navbar";
import { FloatingExpenseButton } from "@/components/features/global/floating-expense-button";
import { Footer } from "@/components/shared/footer";

export function ConditionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Rutas que NO deben tener sidebar (auth, privacy, terms)
  const isAuthRoute = pathname?.startsWith("/sign-in") || pathname?.startsWith("/sign-up");
  const isPolicyRoute = pathname?.startsWith("/privacy") || pathname?.startsWith("/terms");
  
  // Si es ruta de auth, solo mostrar children
  if (isAuthRoute) {
    return <>{children}</>;
  }
  
  // Si es ruta de políticas, mostrar con footer pero sin sidebar
  if (isPolicyRoute) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        {children}
        <Footer />
      </div>
    );
  }
  
  // Para todas las demás rutas, mostrar dashboard layout con sidebar y footer
  return (
    <div className="flex flex-col min-h-screen bg-background overflow-x-hidden">
      <div className="flex flex-1 overflow-x-hidden">
        {/* Sidebar solo visible en desktop - Flotante con margin */}
        <div className="hidden md:block fixed left-0 top-0 h-full z-30">
          <Sidebar />
        </div>

        {/* Contenido principal con margen para el sidebar */}
        {/* Sidebar tiene w-56 (224px) + m-4 izquierdo (16px) = 240px total */}
        <main className="flex-1 md:pl-[240px] w-full overflow-x-hidden pt-16 md:pt-0">
          {/* Navbar móvil visible solo en móvil */}
          <div data-mobile-navbar className="md:hidden sticky top-0 z-40">
            <Navbar />
          </div>

          {/* Contenido de la página */}
          <div className="p-4 pb-24 md:px-4 md:py-4 overflow-x-hidden">
            {children}
          </div>
        </main>

        {/* Botón flotante de gastos */}
        <FloatingExpenseButton />
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

