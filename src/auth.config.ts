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
    maxAge: 14 * 24 * 60 * 60, // 14 días (reducido desde 30)
  },
  secret: process.env.AUTH_SECRET,
  trustHost: process.env.NODE_ENV === "production" ? false : true,
  debug: process.env.NODE_ENV === "development",
  
  // Callbacks para sincronizar el rol
  callbacks: {
    async jwt({ token, user, account }) {
      // Si es un inicio de sesión (user viene del provider)
      if (user) {
        // Copiar el rol del usuario al token
        // El provider (Google o Credentials) debe pasar 'role' en el objeto user
        if (user.role) {
          token.role = user.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Pasar el rol del token a la sesión
      if (session.user && token) {
        // Compatibilidad: 'role' contiene el valor actual
        session.user.role = token.role as string;
        // Explícito: 'roleLegacy' también contiene el valor
        session.user.roleLegacy = token.role as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
