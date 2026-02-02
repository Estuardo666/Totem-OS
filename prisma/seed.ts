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

  // 3. Definir clientes desde la tabla mensual (imagen)
  const clientsData = [
    { name: "Washington", monthlyRate: 270, monthlyReels: 6, monthlyShoots: 0 },
    { name: "Acunar", monthlyRate: 100, monthlyReels: 3, monthlyShoots: 0 },
    { name: "Kinti nuevo", monthlyRate: 0, monthlyReels: 0, monthlyShoots: 1 },
    { name: "Telux nuevo", monthlyRate: 120, monthlyReels: 3, monthlyShoots: 2 },
    { name: "Audisens", monthlyRate: 140, monthlyReels: 3, monthlyShoots: 2 },
    { name: "EUROpeek", monthlyRate: 140, monthlyReels: 3, monthlyShoots: 2 },
    { name: "Ruth", monthlyRate: 180, monthlyReels: 6, monthlyShoots: 0 },
    { name: "Pauly", monthlyRate: 120, monthlyReels: 3, monthlyShoots: 2 },
    { name: "Arevalo", monthlyRate: 120, monthlyReels: 3, monthlyShoots: 2 },
    { name: "Optica", monthlyRate: 120, monthlyReels: 3, monthlyShoots: 2 },
    { name: "Lomas", monthlyRate: 0, monthlyReels: 0, monthlyShoots: 0 },
    { name: "Alegra nuevo", monthlyRate: 140, monthlyReels: 3, monthlyShoots: 2 },
    { name: "Amaca", monthlyRate: 120, monthlyReels: 3, monthlyShoots: 2 },
    { name: "Kathy", monthlyRate: 120, monthlyReels: 3, monthlyShoots: 2 },
    { name: "Germania", monthlyRate: 120, monthlyReels: 3, monthlyShoots: 1 },
    { name: "PlayHouse", monthlyRate: 150, monthlyReels: 3, monthlyShoots: 2 },
    { name: "Gypsum", monthlyRate: 140, monthlyReels: 3, monthlyShoots: 2 },
    { name: "Gaby", monthlyRate: 100, monthlyReels: 3, monthlyShoots: 0 },
    { name: "Paola Inga", monthlyRate: 120, monthlyReels: 3, monthlyShoots: 2 },
  ];

  const today = new Date();
  const startOfCurrentMonth = startOfMonth(today);

  // 4. Crear clientes
  const createdClients = [];
  for (const clientData of clientsData) {
    const client = await prisma.client.create({
      data: {
        name: clientData.name,
        color: "#2563eb",
        status: "ACTIVE",
        monthlyReels: clientData.monthlyReels,
        monthlyFlyers: 0,
        monthlyShoots: clientData.monthlyShoots,
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

  // Crear gastos de ejemplo para reembolsos (almuerzos, transporte, software)
  console.log("\n📝 Creando gastos de ejemplo para reembolsos...");
  const sampleExpenses = [
    { description: "Almuerzo equipo Nimbus", amount: 85000, category: "OFFICE", paidByUserId: admin.id },
    { description: "Uber para rodaje Aura", amount: 45000, category: "EQUIPMENT", paidByUserId: admin.id },
    { description: "Licencia Adobe Creative Cloud", amount: 299900, category: "SOFTWARE", paidByUserId: admin.id },
    { description: "Cafetería oficina", amount: 35000, category: "OFFICE", paidByUserId: admin.id },
    { description: "Gasolina producción", amount: 120000, category: "EQUIPMENT", paidByUserId: admin.id },
  ];

  for (const expense of sampleExpenses) {
    await prisma.expense.create({
      data: {
        description: expense.description,
        amount: expense.amount,
        category: expense.category,
        reimbursed: false,
        date: new Date(),
        paidByUserId: expense.paidByUserId,
      },
    });
    console.log(`  ✓ Gasto creado: ${expense.description} - $${expense.amount.toLocaleString()}`);
  }

  // Crear honorarios de ejemplo
  console.log("\n💰 Creando honorarios de ejemplo...");
  const honorariosTransactions = [
    { description: "Honorarios edición video Aura", amount: 500000, type: "HONORARIOS", userId: admin.id },
    { description: "Honorarios estrategia digital Nimbus", amount: 350000, type: "HONORARIOS", userId: admin.id },
    { description: "Honorarios producción fotos Stellar", amount: 280000, type: "HONORARIOS", userId: admin.id },
  ];

  for (const honorario of honorariosTransactions) {
    await prisma.transaction.create({
      data: {
        description: honorario.description,
        amount: honorario.amount,
        type: honorario.type,
        category: "HONORARIOS",
        status: "PAID",
        userId: honorario.userId,
      },
    });
    console.log(`  ✓ Honorario creado: ${honorario.description} - $${honorario.amount.toLocaleString()}`);
  }

  console.log("\n✅ Seeding completado:");
  console.log(`   - ${createdClients.length} clientes creados`);
  console.log(`   - 10 tareas creadas`);
  console.log(`   - ${sampleExpenses.length} gastos de reembolso creados`);
  console.log(`   - ${honorariosTransactions.length} honorarios creados`);
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

