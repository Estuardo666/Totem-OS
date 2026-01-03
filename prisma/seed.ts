import { PrismaClient } from "@prisma/client";
import { addDays, startOfMonth } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando siembra de datos dummy (Seeding)...");

  // 1. Limpiar base de datos antes de sembrar (evita duplicados)
  console.log("🧹 Limpiando base de datos...");
  await prisma.contentTask.deleteMany();
  await prisma.shoot.deleteMany();
  await prisma.client.deleteMany();
  // NO eliminar usuarios para mantener autenticación
  console.log("✅ Base de datos limpiada");

  // 2. Crear Usuario Admin (si no existe)
  const admin = await prisma.user.upsert({
    where: { email: "admin@totem.com" },
    update: {},
    create: {
      email: "admin@totem.com",
      name: "Stuart Admin",
      roleLegacy: "ADMIN",
      specialty: null,
      image: "https://avatar.vercel.sh/stuart",
    },
  });
  console.log(`👤 Usuario admin: ${admin.email}`);

  // 3. Definir exactamente 5 Clientes Dummy
  const clientsData = [
    { name: "Audisens", color: "#2563eb", monthlyReels: 3, monthlyFlyers: 1, monthlyRate: 500 },
    { name: "TransCity", color: "#16a34a", monthlyReels: 3, monthlyFlyers: 1, monthlyRate: 600 },
    { name: "Arevalo Moda", color: "#dc2626", monthlyReels: 3, monthlyFlyers: 1, monthlyRate: 450 },
    { name: "7 Pingas", color: "#d97706", monthlyReels: 3, monthlyFlyers: 1, monthlyRate: 400 },
    { name: "La Choricería", color: "#9333ea", monthlyReels: 3, monthlyFlyers: 1, monthlyRate: 350 },
  ];

  const today = new Date();
  const startOfCurrentMonth = startOfMonth(today);

  // 4. Crear exactamente 5 Clientes
  const createdClients = [];
  for (const clientData of clientsData) {
    const client = await prisma.client.create({
      data: {
        name: clientData.name,
        color: clientData.color,
        status: "ACTIVE",
        monthlyReels: clientData.monthlyReels,
        monthlyFlyers: clientData.monthlyFlyers,
        monthlyRate: clientData.monthlyRate,
        hasPendingFeedback: false,
      },
    });
    createdClients.push(client);
    console.log(`🏢 Cliente creado: ${client.name}`);
  }

  // 5. Crear exactamente 10 Tareas distribuidas entre los 5 clientes (2 tareas por cliente)
  const taskTemplates = [
    { title: "Reel: Tendencia Mensual", type: "REEL", status: "IDEA", dayOffset: 2 },
    { title: "Reel: Educativo / Valor", type: "REEL", status: "RECORDED", dayOffset: 9 },
    { title: "Reel: Venta / Promo", type: "REEL", status: "EDITING", dayOffset: 16 },
    { title: "Flyer: Promo del Mes", type: "FLYER", status: "REVIEW_INTERNAL", dayOffset: 23 },
    { title: "Story: Behind the Scenes", type: "STORY", status: "PUBLISHED", dayOffset: 5 },
    { title: "Reel: Testimonial Cliente", type: "REEL", status: "IDEA", dayOffset: 12 },
    { title: "Flyer: Oferta Especial", type: "FLYER", status: "REVIEW_CLIENT", dayOffset: 19 },
    { title: "Reel: Tutorial Rápido", type: "REEL", status: "APPROVED", dayOffset: 26 },
    { title: "Story: Lanzamiento Producto", type: "STORY", status: "IDEA", dayOffset: 7 },
    { title: "Reel: Contenido Viral", type: "REEL", status: "PUBLISHED", dayOffset: 14 },
  ];

  console.log("📝 Creando 10 tareas...");
  for (let i = 0; i < 10; i++) {
    const taskTemplate = taskTemplates[i];
    const client = createdClients[i % 5]; // Distribuir entre los 5 clientes
    const scheduledDate = addDays(startOfCurrentMonth, taskTemplate.dayOffset);

    await prisma.contentTask.create({
      data: {
        title: `${taskTemplate.title} - ${client.name}`,
        type: taskTemplate.type,
        status: taskTemplate.status,
        clientId: client.id,
        assignedEditorId: admin.id,
        scheduledAt: scheduledDate,
        assignedAt: new Date(),
        priority: i < 3 ? "HIGH" : i < 6 ? "MEDIUM" : "LOW",
      },
    });
    console.log(`  ✓ Tarea ${i + 1}/10: "${taskTemplate.title}" para ${client.name}`);
  }

  console.log("\n✅ Seeding completado:");
  console.log(`   - ${createdClients.length} clientes creados`);
  console.log(`   - 10 tareas creadas`);
  console.log(`   - Usuario admin: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

