"use client";

import Image from "next/image";

interface AnimatedGridBackgroundProps {
  backgroundUrl?: string | null;
}

export function AnimatedGridBackground({ backgroundUrl }: AnimatedGridBackgroundProps) {
  // Si hay un background personalizado, usarlo
  if (backgroundUrl) {
    return (
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <Image
          src={backgroundUrl}
          alt="Background del login"
          fill
          className="object-cover"
          priority
          quality={90}
        />
        {/* Overlay sutil para mejorar legibilidad del contenido */}
        <div className="absolute inset-0 bg-black/20 dark:bg-black/40" />
      </div>
    );
  }

  // Si no hay background personalizado, usar el gradiente animado por defecto
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Fondo base - usando gradiente más visible */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-primary/10" />
      
      {/* Efecto de borde animado - mismo que el componente de IA */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 animate-pulse" />
    </div>
  );
}

