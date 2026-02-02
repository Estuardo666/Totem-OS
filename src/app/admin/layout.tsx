import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Verificar que el usuario esté autenticado
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  // Obtener datos del usuario para verificar el rol
  const { db } = await import("@/lib/db");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      roleLegacy: true,
    },
  });

  // Verificar que el usuario exista
  if (!user) {
    redirect("/sign-in");
  }

  // Solo los usuarios ADMIN pueden acceder a las rutas de admin
  if (user.roleLegacy !== "ADMIN") {
    redirect("/");
  }

  return <>{children}</>;
}
