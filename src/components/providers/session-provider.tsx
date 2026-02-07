"use client";

import { SessionProvider } from "next-auth/react";

/**
 * SessionProvider con sesión mock para evitar crashes
 * 
 * Pasa session=null para evitar que SessionProvider intente hacer fetch a /api/auth/session
 * que está fallando con 500 por falta de AUTH_SECRET en Vercel
 * 
 * Los componentes pueden usar useSession() normalmente, solo obtendrán session null
 */

export function NextAuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider 
      session={null}  // Pasar null evita fetch inicial
      basePath="/api/auth"
      refetchInterval={0}
      refetchOnWindowFocus={false}
    >
      {children}
    </SessionProvider>
  );
}

