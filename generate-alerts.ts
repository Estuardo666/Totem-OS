import { PrismaClient } from "@prisma/client";
import { evaluateFinanceAlerts } from "./src/actions/finance-alerts-actions";

const prisma = new PrismaClient();

async function generateAlerts() {
  try {
    console.log("🔍 Evaluando alertas financieras...");
    
    const result = await evaluateFinanceAlerts();
    
    if (result.success) {
      console.log(`✅ Alertas generadas: ${result.data?.alerts.length || 0}`);
      if (result.data?.alerts) {
        result.data.alerts.forEach((alert, index) => {
          console.log(`  ${index + 1}. ${alert.title} (${alert.severity})`);
        });
      }
    } else {
      console.error("❌ Error:", result.error);
    }
  } catch (error) {
    console.error("❌ Error al generar alertas:", error);
  } finally {
    await prisma.$disconnect();
  }
}

generateAlerts();
