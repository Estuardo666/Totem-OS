import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Restablece la contraseña de una cuenta.
 *
 * El email y la contraseña se leen de variables de entorno: nunca deben
 * escribirse en el código, porque este repositorio es público y cualquier
 * valor aquí queda expuesto de forma permanente en el historial de git.
 *
 * Uso (PowerShell):
 *   $env:RESET_EMAIL="correo@ejemplo.com"; $env:RESET_PASSWORD="la-nueva"; npx tsx reset-admin-password.ts
 */
async function resetAdminPassword() {
  const email = process.env.RESET_EMAIL;
  const newPassword = process.env.RESET_PASSWORD;

  if (!email || !newPassword) {
    console.error("Faltan RESET_EMAIL y/o RESET_PASSWORD en las variables de entorno.");
    process.exit(1);
  }

  if (newPassword.length < 12) {
    console.error("La contraseña debe tener al menos 12 caracteres.");
    process.exit(1);
  }

  const hashedPassword = await bcryptjs.hash(newPassword, 10);

  const updated = await prisma.user.update({
    where: { email },
    data: { password: hashedPassword },
  });

  console.log(`Contraseña actualizada para: ${updated.email}`);
}

resetAdminPassword()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
