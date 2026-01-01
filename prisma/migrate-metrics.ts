import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Script de migración para mover datos de métricas antiguas a nuevas columnas por plataforma
 * Ejecutar con: npx tsx prisma/migrate-metrics.ts
 */
async function migrateMetrics() {
  try {
    console.log("🔄 Iniciando migración de métricas...");

    // Obtener todas las métricas existentes
    const allMetrics = await prisma.$queryRaw<Array<{
      id: string;
      taskId: string;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
      reach: number;
    }>>`
      SELECT id, "taskId", views, likes, comments, shares, saves, reach
      FROM "TaskMetrics"
      WHERE views > 0 OR likes > 0 OR comments > 0 OR shares > 0 OR saves > 0 OR reach > 0
    `;

    console.log(`📊 Encontradas ${allMetrics.length} métricas para migrar`);

    // Migrar cada métrica: asumir que los datos antiguos son de Meta (Instagram)
    for (const metric of allMetrics) {
      await prisma.$executeRaw`
        UPDATE "TaskMetrics"
        SET 
          "metaViews" = ${metric.views},
          "metaLikes" = ${metric.likes},
          "metaComments" = ${metric.comments},
          "metaShares" = ${metric.shares},
          "metaSaves" = ${metric.saves},
          "metaReach" = ${metric.reach}
        WHERE id = ${metric.id}
      `;

      console.log(`✅ Migrada métrica ${metric.id}`);
    }

    console.log("✅ Migración completada exitosamente");
  } catch (error) {
    console.error("❌ Error en la migración:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateMetrics();

