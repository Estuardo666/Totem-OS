import { Suspense } from "react";
import { AnimatedGridBackground } from "@/components/ui/animated-background";
import { getPublicLoginBackground } from "@/actions/admin-actions";

/**
 * Componente que obtiene el fondo de la base de datos y renderiza el background
 * Se ejecuta en el servidor pero está envuelto en Suspense
 */
async function BackgroundWrapper() {
  const backgroundResult = await getPublicLoginBackground();
  const backgroundUrl = backgroundResult.success && backgroundResult.data 
    ? backgroundResult.data.backgroundUrl 
    : null;

  return <AnimatedGridBackground backgroundUrl={backgroundUrl} />;
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen w-full">
      {/* Suspense para el background - no bloquea el renderizado del layout */}
      <Suspense fallback={<div className="fixed inset-0 bg-background" />}>
        <BackgroundWrapper />
      </Suspense>
      
      {/* Children se renderiza inmediatamente con z-index superior */}
      <div className="relative flex items-center justify-center min-h-screen w-full z-10">
        {children}
      </div>
    </div>
  );
}

