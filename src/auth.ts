import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db as prisma } from "@/lib/db";
import {
  clearPrismaConnectionBackoff,
  registerPrismaConnectionIssue,
  shouldSkipPrismaConnectionAttempt,
} from "@/lib/prisma-connection-resilience";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { normalizeCanonicalRole, resolveRoleCode } from "@/lib/roles";

/**
 * Configuración completa de NextAuth para Node.js Runtime
 * Incluye Prisma Adapter y callbacks que requieren acceso a la base de datos
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers, // Google provider desde authConfig
    // Agregar Credentials provider aquí porque requiere Prisma
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          roleCode: user.roleCode,
          role: user.roleCode, // Compatibilidad durante la migración
          specialty: user.specialty, // Incluir especialidad
          primaryColor: user.primaryColor,
          themeId: user.themeId === "catppuccin" ? "catppuccin" : "default",
          catppuccinAccent: user.catppuccinAccent,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Verificar que el usuario tenga email
      if (!user.email) {
        return false;
      }

      // Si es autenticación con Google (OAuth), crear o actualizar el usuario en Prisma
      if (account?.provider === "google" && user.email) {
        try {
          // Buscar si el usuario ya existe
          let dbUser = await prisma.user.findUnique({
            where: { email: user.email },
          });

          if (!dbUser) {
            // Crear nuevo usuario si no existe (Prisma generará el ID automáticamente)
            dbUser = await prisma.user.create({
              data: {
                email: user.email,
                name: user.name || "",
                image: user.image || null,
                emailVerified: new Date(),
                roleLegacy: "EDITOR", // Rol por defecto (Legacy)
                roleCode: "EDITOR",
                specialty: null, // Especialidad nula por defecto
              },
            });
            console.log("✅ Usuario creado en Prisma:", user.email, "ID:", dbUser.id);
          } else {
            // Actualizar usuario existente con datos de Google
            dbUser = await prisma.user.update({
              where: { id: dbUser.id },
              data: {
                name: user.name || dbUser.name,
                image: user.image || dbUser.image,
                emailVerified: dbUser.emailVerified || new Date(),
              },
            });
            console.log("✅ Usuario actualizado en Prisma:", user.email, "ID:", dbUser.id);
          }

          // Crear o actualizar Account para Google OAuth
          if (account) {
            await prisma.account.upsert({
              where: {
                provider_providerAccountId: {
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                },
              },
              update: {
                access_token: account.access_token || null,
                expires_at: account.expires_at || null,
                id_token: account.id_token || null,
                refresh_token: account.refresh_token || null,
                scope: account.scope || null,
                token_type: account.token_type || null,
                type: account.type,
              },
              create: {
                userId: dbUser.id,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                type: account.type,
                access_token: account.access_token || null,
                expires_at: account.expires_at || null,
                id_token: account.id_token || null,
                refresh_token: account.refresh_token || null,
                scope: account.scope || null,
                token_type: account.token_type || null,
              },
            });
            console.log("✅ Account creado/actualizado para:", user.email);
          }

          // Actualizar el user.id con el ID de Prisma para que el JWT tenga el ID correcto
          user.id = dbUser.id;
          // Asegurar que el rol esté en el objeto user para el callback jwt
          const roleCode = resolveRoleCode({ roleCode: dbUser.roleCode, roleLegacy: dbUser.roleLegacy }) ?? "USER";
          user.roleCode = roleCode;
          user.role = roleCode;
          user.specialty = dbUser.specialty || null;
          user.primaryColor = dbUser.primaryColor || "#3b82f6";
          user.themeId = dbUser.themeId === "catppuccin" ? "catppuccin" : "default";
          user.catppuccinAccent = dbUser.catppuccinAccent;
        } catch (error) {
          console.error("❌ Error al crear/actualizar usuario:", error);
          // Continuar con el login aunque haya error
        }
      }

      // Para credentials, asegurar que el rol esté disponible
      if (account?.provider === "credentials" && user.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email },
            select: { roleCode: true, roleLegacy: true, specialty: true, primaryColor: true, themeId: true, catppuccinAccent: true },
          });
          // Asegurar que el rol esté en el objeto user para el callback jwt
          const roleCode = resolveRoleCode({ roleCode: dbUser?.roleCode, roleLegacy: dbUser?.roleLegacy }) ?? "USER";
          user.roleCode = roleCode;
          user.role = roleCode;
          user.specialty = dbUser?.specialty || null;
          user.primaryColor = dbUser?.primaryColor || "#3b82f6";
          user.themeId = dbUser?.themeId === "catppuccin" ? "catppuccin" : "default";
          user.catppuccinAccent = dbUser?.catppuccinAccent || "mauve";
        } catch (error) {
          console.error("❌ Error al obtener rol para credentials:", error);
          user.roleCode = normalizeCanonicalRole(user.roleCode ?? user.role) ?? "USER";
          user.role = user.roleCode;
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      // Cuando el usuario inicia sesión por primera vez
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.image = user.image;
        // Si el usuario trae rol del provider, úsalo
        const roleCode = normalizeCanonicalRole(user.roleCode ?? user.role);
        if (roleCode) {
          token.roleCode = roleCode;
          token.role = roleCode;
        }
        if (user.specialty !== undefined) {
          token.specialty = user.specialty as string | null;
        }
        if (user.primaryColor !== undefined) {
          token.primaryColor = user.primaryColor as string | null;
        }
        if (user.themeId !== undefined) token.themeId = user.themeId;
        if (user.catppuccinAccent !== undefined) token.catppuccinAccent = user.catppuccinAccent;
      }
      
      // Sincronizar rol desde BD solo si es posible
      // IMPORTANTE: Si hay error o no hay datos, MANTENER el rol actual del token
      // para evitar downgrades accidentales durante deployments o problemas de BD
      if (token.id && !shouldSkipPrismaConnectionAttempt()) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { roleCode: true, roleLegacy: true, image: true, specialty: true, primaryColor: true, themeId: true, catppuccinAccent: true },
          });
          clearPrismaConnectionBackoff();
          
          // Solo actualizar si la consulta fue exitosa Y hay un valor válido
          const roleCode = resolveRoleCode({ roleCode: dbUser?.roleCode, roleLegacy: dbUser?.roleLegacy });
          if (roleCode) {
            token.roleCode = roleCode;
            token.role = roleCode;
          }
          // Si la BD no devuelve un rol válido, mantener el token existente;
          // nunca se introduce un downgrade implícito a EDITOR.
          
          // Sincronizar imagen solo si existe en BD
          if (dbUser?.image) {
            token.image = dbUser.image;
          }
          // Sincronizar especialidad solo si el usuario existe
          if (dbUser) {
            token.specialty = dbUser.specialty;
            token.primaryColor = dbUser.primaryColor;
            token.themeId = dbUser.themeId === "catppuccin" ? "catppuccin" : "default";
            token.catppuccinAccent = dbUser.catppuccinAccent;
          }
        } catch (error) {
          if (!registerPrismaConnectionIssue(error)) {
            console.error("Error al obtener rol del usuario:", error);
          }
          // ⚠️ En caso de error de BD, MANTENER el rol actual del token
          // NO hacer downgrade a EDITOR - el usuario conserva sus permisos
          console.warn("⚠️ Manteniendo rol actual del token debido a error de BD");
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        const roleCode = normalizeCanonicalRole(token.roleCode ?? token.role) ?? "USER";
        session.user.roleCode = roleCode;
        session.user.role = roleCode; // Compatibilidad
        session.user.roleLegacy = roleCode; // Dual-read legacy
        session.user.specialty = token.specialty as string | null; // Especialidad
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.image as string;
        session.user.primaryColor = token.primaryColor as string | null;
        session.user.themeId = token.themeId === "catppuccin" ? "catppuccin" : "default";
        session.user.catppuccinAccent = token.catppuccinAccent as string | null;
      }
      return session;
    },
  },
});

