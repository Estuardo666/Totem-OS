/**
 * Componente Avatar Optimizado con next/image
 * Usa Image de Next.js para mejor rendimiento y lazy loading automático
 */

"use client";

import React from "react";
import Image from "next/image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface OptimizedAvatarProps {
  src?: string | null;
  alt: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  priority?: boolean;
}

const sizeMap = {
  sm: 24,
  md: 32,
  lg: 40,
};

/**
 * Avatar optimizado que reemplaza AvatarImage por next/image
 * Mejora: Lazy loading automático, optimización de tamaño, caché
 */
export const OptimizedAvatar = React.memo(
  ({ src, alt, fallback, size = "md", priority = false }: OptimizedAvatarProps) => {
    const sizePixels = sizeMap[size];

    if (!src) {
      return (
        <Avatar className={getAvatarClass(size)}>
          <AvatarFallback className="text-xs">{fallback}</AvatarFallback>
        </Avatar>
      );
    }

    return (
      <Avatar className={getAvatarClass(size)}>
        <div className="w-full h-full relative">
          <Image
            src={src}
            alt={alt}
            fill
            sizes={`${sizePixels}px`}
            priority={priority}
            className="object-cover rounded-full"
            quality={75}
            onError={(e) => {
              // Si la imagen falla, mostrar fallback
              const target = e.target as HTMLImageElement;
              target.src = ""; // Vaciar src para que muestre fallback
            }}
          />
        </div>
        {fallback && <AvatarFallback className="text-xs">{fallback}</AvatarFallback>}
      </Avatar>
    );
  }
);

OptimizedAvatar.displayName = "OptimizedAvatar";

function getAvatarClass(size: "sm" | "md" | "lg"): string {
  const classes: Record<string, string> = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };
  return classes[size];
}
