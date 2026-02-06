"use client";

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
      // Hacer tolerante los errores de sesión
      onUnauthenticated={() => {
        // No hacer nada, permitir que el sitio se cargue sin sesión
      }}
    >
      {children}
    </SessionProvider>
  );
}

