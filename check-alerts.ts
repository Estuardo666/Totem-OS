import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkAlerts() {
  try {
    console.log("🔍 Verificando alertas existentes...");
    
    // Obtener todas las alertas
    const alerts = await prisma.financeAlert.findMany({
      include: {
        assignedTo: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`📊 Total de alertas: ${alerts.length}`);
    
    if (alerts.length > 0) {
      console.log("\n🚨 Alertas encontradas:");
      alerts.forEach((alert, index) => {
        console.log(`\n${index + 1}. ${alert.title}`);
        console.log(`   Tipo: ${alert.type}`);
        console.log(`   Severidad: ${alert.severity}`);
        console.log(`   Estado: ${alert.status}`);
        console.log(`   Mensaje: ${alert.message}`);
        console.log(`   Asignado a: ${alert.assignedTo?.name || 'N/A'}`);
        console.log(`   Creada: ${alert.createdAt.toLocaleString()}`);
      });
    } else {
      console.log("❌ No se encontraron alertas");
    }
    
    // Obtener reglas
    const rules = await prisma.financeAlertRule.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`\n📋 Total de reglas: ${rules.length}`);
    
    if (rules.length > 0) {
      console.log("\n📋 Reglas encontradas:");
      rules.forEach((rule, index) => {
        console.log(`\n${index + 1}. ${rule.name}`);
        console.log(`   Clave: ${rule.key}`);
        console.log(`   Habilitada: ${rule.enabled ? 'Sí' : 'No'}`);
        console.log(`   Severidad: ${rule.severity}`);
        console.log(`   Descripción: ${rule.description || 'N/A'}`);
      });
    }
    
  } catch (error) {
    console.error("❌ Error al verificar alertas:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAlerts();
