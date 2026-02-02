import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";

const prisma = new PrismaClient();

async function resetAdminPassword() {
  const newPassword = "LOXAliberis9713";
  const hashedPassword = await bcryptjs.hash(newPassword, 10);

  const updated = await prisma.user.update({
    where: { email: "admin@totem.com" },
    data: { password: hashedPassword },
  });

  console.log(`✅ Contraseña actualizada para: ${updated.email}`);
  console.log(`🔑 Nueva contraseña: ${newPassword}`);
}

resetAdminPassword()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
