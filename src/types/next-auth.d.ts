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
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    role?: string; // Usado durante el signIn, mapeado a roleLegacy
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    role: string; // Almacena el valor de roleLegacy
  }
}
