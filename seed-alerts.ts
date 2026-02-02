import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedAlerts() {
  try {
    console.log("🌱 Creando reglas de alertas por defecto...");

    // Crear reglas por defecto
    const defaultRules = [
      {
        key: "LOW_PROFIT_MARGIN",
        name: "Margen de Beneficio Bajo",
        description: "Alerta cuando el margen de beneficio cae por debajo del umbral",
        enabled: true,
        severity: "WARNING",
        config: JSON.stringify({ threshold: 15 }),
      },
      {
        key: "HIGH_EXPENSES",
        name: "Gastos Elevados",
        description: "Alerta cuando los gastos mensuales superan el presupuesto",
        enabled: true,
        severity: "WARNING",
        config: JSON.stringify({ threshold: 2000000 }),
      },
      {
        key: "NEGATIVE_CASH_FLOW",
        name: "Flujo de Caja Negativo",
        description: "Alerta cuando el flujo de caja es negativo por 2 meses consecutivos",
        enabled: true,
        severity: "CRITICAL",
        config: JSON.stringify({ consecutiveMonths: 2 }),
      },
      {
        key: "LOW_RUNWAY",
        name: "Runway Bajo",
        description: "Alerta cuando el runway cae por debajo de 30 días",
        enabled: true,
        severity: "CRITICAL",
        config: JSON.stringify({ thresholdDays: 30 }),
      },
    ];

    for (const rule of defaultRules) {
      await prisma.financeAlertRule.upsert({
        where: { key: rule.key },
        update: rule,
        create: rule,
      });
      console.log(`  ✓ Regla creada: ${rule.name}`);
    }

    console.log("\n🚨 Creando alertas de ejemplo...");

    // Obtener usuarios para asignar alertas
    const admin = await prisma.user.findFirst({ where: { email: "admin@totem.com" } });

    if (!admin) {
      throw new Error("Usuario admin no encontrado");
    }

    const sampleAlerts = [
      {
        type: "LOW_PROFIT_MARGIN",
        severity: "WARNING",
        status: "ACTIVE",
        title: "Margen de Beneficio Bajo Detectado",
        message: "El margen de beneficio del mes actual es del 12.5%, por debajo del umbral del 15%.",
        fingerprint: "low-margin-2024-01",
        metadata: JSON.stringify({
          currentMargin: 12.5,
          threshold: 15,
          month: "2024-01",
        }),
        assignedToId: admin.id,
      },
      {
        type: "HIGH_EXPENSES",
        severity: "WARNING",
        status: "ACTIVE",
        title: "Gastos Mensuales Elevados",
        message: "Los gastos de enero ($2,450,000) superan el presupuesto establecido ($2,000,000).",
        fingerprint: "high-expenses-2024-01",
        metadata: JSON.stringify({
          currentExpenses: 2450000,
          budget: 2000000,
          month: "2024-01",
        }),
        assignedToId: admin.id,
      },
      {
        type: "NEGATIVE_CASH_FLOW",
        severity: "CRITICAL",
        status: "ACTIVE",
        title: "Flujo de Caja Negativo",
        message: "Se detectó flujo de caja negativo por segundo mes consecutivo. Requiere acción inmediata.",
        fingerprint: "negative-cashflow-2024-01",
        metadata: JSON.stringify({
          consecutiveMonths: 2,
          currentCashFlow: -350000,
        }),
        assignedToId: admin.id,
      },
      {
        type: "LOW_RUNWAY",
        severity: "CRITICAL",
        status: "ACTIVE",
        title: "Runway Críticamente Bajo",
        message: "El runway actual es de 18 días, por debajo del umbral crítico de 30 días.",
        fingerprint: "low-runway-2024-01",
        metadata: JSON.stringify({
          currentRunwayDays: 18,
          thresholdDays: 30,
        }),
        assignedToId: admin.id,
        resolvedAt: null,
      },
      {
        type: "BUDGET_DEVIATION",
        severity: "INFO",
        status: "RESOLVED",
        title: "Desviación de Presupuesto",
        message: "Desviación del 8% en el presupuesto de marketing del mes pasado.",
        fingerprint: "budget-deviation-2023-12",
        metadata: JSON.stringify({
          deviation: 8,
          category: "marketing",
          month: "2023-12",
        }),
        assignedToId: admin.id,
        resolvedAt: new Date("2024-01-15"),
      },
    ];

    for (const alert of sampleAlerts) {
      await prisma.financeAlert.create({
        data: alert,
      });
      console.log(`  ✓ Alerta creada: ${alert.title}`);
    }

    console.log("\n✅ Alertas y reglas creadas exitosamente!");
    console.log(`📊 Total de reglas: ${defaultRules.length}`);
    console.log(`🚨 Total de alertas: ${sampleAlerts.length}`);

  } catch (error) {
    console.error("❌ Error al crear alertas:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedAlerts();
