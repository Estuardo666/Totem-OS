import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db as prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";

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
          role: user.role, // Incluir el rol en el objeto de usuario
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
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
                role: "EDITOR", // Rol por defecto
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
        } catch (error) {
          console.error("❌ Error al crear/actualizar usuario:", error);
          // Continuar con el login aunque haya error
        }
      }

      return true;
    },
    async jwt({ token, user, account }) {
      // Cuando el usuario inicia sesión por primera vez
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.image = user.image;
      }
      
      // Siempre obtener el rol actualizado desde la base de datos
      // Esto asegura que si el rol cambia en la DB, se refleje en la sesión
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true },
          });
          if (dbUser) {
            token.role = dbUser.role;
          }
        } catch (error) {
          console.error("Error al obtener rol del usuario:", error);
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.image as string;
      }
      return session;
    },
  },
});

