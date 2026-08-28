import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      role: string; // Compatibilidad: Contiene el valor de roleLegacy
      roleLegacy: string; // Explícito: Valor real guardado en DB
      roleCode: string; // Fuente canónica de autorización
      specialty?: string | null;
      primaryColor?: string | null;
      themeId?: "default" | "catppuccin" | null;
      catppuccinAccent?: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    role?: string; // Usado durante el signIn, mapeado a roleLegacy
    roleCode?: string; // Rol canónico
    specialty?: string | null;
    primaryColor?: string | null;
    themeId?: "default" | "catppuccin" | null;
    catppuccinAccent?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    role: string; // Almacena el valor de roleLegacy
    roleCode: string; // Rol canónico
    specialty?: string | null;
    primaryColor?: string | null;
    themeId?: "default" | "catppuccin" | null;
    catppuccinAccent?: string | null;
  }
}
