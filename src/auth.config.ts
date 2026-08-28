import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { normalizeCanonicalRole } from "./lib/roles";

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
  // Auth.js v5 recomienda AUTH_SECRET; conservar NEXTAUTH_SECRET como
  // fallback evita romper instalaciones existentes durante la migración.
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true, // Permitir hosts de Vercel
  debug: process.env.NODE_ENV === "development",
  
  // Callbacks para sincronizar el rol
  callbacks: {
    async jwt({ token, user, account }) {
      // Si es un inicio de sesión (user viene del provider)
      if (user) {
        // Copiar el rol del usuario al token
        // El provider (Google o Credentials) debe pasar 'role' en el objeto user
        const roleCode = normalizeCanonicalRole(user.roleCode ?? user.role);
        if (roleCode) {
          token.roleCode = roleCode;
          token.role = roleCode;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Pasar el rol del token a la sesión
      if (session.user && token) {
        // Compatibilidad: 'role' contiene el valor actual
        const roleCode = normalizeCanonicalRole(token.roleCode ?? token.role) ?? "USER";
        session.user.roleCode = roleCode;
        session.user.role = roleCode;
        // Compatibilidad: roleLegacy también refleja el rol canónico.
        session.user.roleLegacy = roleCode;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
