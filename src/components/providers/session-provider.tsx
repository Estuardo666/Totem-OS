"use client";

import { SessionProvider } from "next-auth/react";

/**
 * SessionProvider wrapper para next-auth
 * trustHost está habilitado en auth.config.ts para funcionar en Vercel
 */

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

