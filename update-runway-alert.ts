import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function updateRunwayAlert() {
  try {
    console.log("🔄 Actualizando alerta de runway...");

    // Buscar la alerta de runway existente
    const existingAlert = await prisma.financeAlert.findFirst({
      where: {
        fingerprint: "low-runway-2024-01"
      }
    });

    if (!existingAlert) {
      console.log("❌ No se encontró la alerta de runway existente");
      return;
    }

    // Actualizar la alerta con los nuevos valores
    const updatedAlert = await prisma.financeAlert.update({
      where: {
        id: existingAlert.id
      },
      data: {
        message: "El runway actual es de 18 días, por debajo del umbral crítico de 30 días.",
        metadata: JSON.stringify({
          currentRunwayDays: 18,
          thresholdDays: 30,
        }),
        status: "ACTIVE", // Cambiar a ACTIVE para que aparezca como alerta activa
        resolvedAt: null, // Asegurar que no esté resuelta
      }
    });

    console.log("✅ Alerta de runway actualizada exitosamente:");
    console.log(`   Nuevo mensaje: ${updatedAlert.message}`);
    console.log(`   Nuevo estado: ${updatedAlert.status}`);
    console.log(`   Nuevos metadatos: ${updatedAlert.metadata}`);

  } catch (error) {
    console.error("❌ Error al actualizar alerta:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateRunwayAlert();
