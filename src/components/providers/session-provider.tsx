"use client";

/**
 * SessionProvider COMPLETAMENTE DESHABILITADO
 * 
 * NextAuth está causando React error #310 cuando /api/auth/session falla con 500
 * Esto crashea todo el sitio en producción.
 * 
 * SOLUCIÓN TEMPORAL: No usar SessionProvider hasta que AUTH_SECRET esté en Vercel
 * Los componentes que usan useSession() simplemente NO obtendrán sesión.
 * 
 * Para reactivar:
 * 1. Configurar AUTH_SECRET en Vercel
 * 2. Verificar que /api/auth/session responda 200
 * 3. Descomentar el código de abajo
 */

export function NextAuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sin SessionProvider, useSession() devolverá undefined/null en los componentes
  return <>{children}</>;
}

/* CÓDIGO PARA REACTIVAR CUANDO AUTH FUNCIONE:

import { SessionProvider } from "next-auth/react";

export function NextAuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider 
      basePath="/api/auth"
      refetchInterval={0}
      refetchOnWindowFocus={false}
    >
      {children}
    </SessionProvider>
  );
}
*/

