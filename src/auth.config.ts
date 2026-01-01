import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Configuración base de NextAuth para Edge Runtime (Middleware)
 * NO debe importar Prisma ni @/lib/db
 * Solo incluye providers que no requieren acceso a la base de datos
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // Credentials provider se agregará en auth.ts porque requiere Prisma
  ],
  pages: {
    signIn: "/sign-in",
    signOut: "/sign-in",
  },
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  secret: process.env.AUTH_SECRET,
  trustHost: true, // Necesario para desarrollo local y algunos entornos
  debug: process.env.NODE_ENV === "development",
} satisfies NextAuthConfig;

