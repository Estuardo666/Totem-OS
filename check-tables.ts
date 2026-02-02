import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkTables() {
  try {
    console.log("🔍 Verificando tablas en la base de datos...");
    
    // Obtener todas las tablas
    const tables = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`;
    
    console.log("📋 Tablas encontradas:");
    console.table(tables);
    
    // Verificar específicamente las tablas de alertas
    const alertTables = (tables as any[]).filter((table: any) => 
      table.name.toLowerCase().includes('alert')
    );
    
    if (alertTables.length > 0) {
      console.log("\n🚨 Tablas de alertas encontradas:");
      console.table(alertTables);
    } else {
      console.log("\n❌ No se encontraron tablas de alertas");
    }
    
  } catch (error) {
    console.error("❌ Error al verificar tablas:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();
