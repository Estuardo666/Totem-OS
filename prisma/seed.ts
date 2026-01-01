import { PrismaClient } from "@prisma/client";
import { addDays, startOfMonth } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando siembra de datos (Seeding)...");

  // 1. Limpiar base de datos (Opcional, pero recomendado para evitar duplicados en seeds)
  // Descomenta las siguientes líneas si quieres limpiar antes de sembrar
  // await prisma.contentTask.deleteMany();
  // await prisma.shoot.deleteMany();
  // await prisma.client.deleteMany();
  // await prisma.user.deleteMany();

  // 2. Crear Usuario Admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@totem.com" },
    update: {},
    create: {
      email: "admin@totem.com",
      name: "Stuart Admin",
      role: "ADMIN",
      // Si usas Credentials, aquí iría el hash. Si usas Google, este usuario se vinculará al hacer login.
      image: "https://avatar.vercel.sh/stuart",
    },
  });
  console.log(`👤 Usuario creado: ${admin.email}`);

  // 3. Definir Clientes Dummy
  const clientsData = [
    { name: "Audisens", color: "#2563eb", monthlyReels: 3, monthlyFlyers: 1 },
    { name: "TransCity", color: "#16a34a", monthlyReels: 3, monthlyFlyers: 1 },
    { name: "Arevalo Moda", color: "#dc2626", monthlyReels: 3, monthlyFlyers: 1 },
    { name: "7 Pingas", color: "#d97706", monthlyReels: 3, monthlyFlyers: 1 },
    { name: "La Choricería", color: "#9333ea", monthlyReels: 3, monthlyFlyers: 1 },
    { name: "Totem Internal", color: "#000000", monthlyReels: 3, monthlyFlyers: 1 },
  ];

  // 4. Definir Plan Estándar (3 Reels, 1 Flyer)
  const standardPlan = [
    { title: "Reel: Tendencia Mensual", type: "REEL", dayOffset: 2 },
    { title: "Reel: Educativo / Valor", type: "REEL", dayOffset: 9 },
    { title: "Reel: Venta / Promo", type: "REEL", dayOffset: 16 },
    { title: "Flyer: Promo del Mes", type: "FLYER", dayOffset: 23 },
  ];

  const today = new Date();
  const startOfCurrentMonth = startOfMonth(today);

  // 5. Crear Clientes y Tareas
  for (const clientData of clientsData) {
    const client = await prisma.client.create({
      data: {
        name: clientData.name,
        color: clientData.color,
        status: "ACTIVE",
        monthlyReels: clientData.monthlyReels,
        monthlyFlyers: clientData.monthlyFlyers,
        monthlyRate: 0, // Puedes ajustar esto según necesites
      },
    });

    console.log(`🏢 Cliente creado: ${client.name}`);

    // Crear Tareas del Plan Estándar para este cliente
    for (const taskTemplate of standardPlan) {
      const scheduledDate = addDays(startOfCurrentMonth, taskTemplate.dayOffset);
      await prisma.contentTask.create({
        data: {
          title: taskTemplate.title,
          type: taskTemplate.type,
          status: "IDEA", // Estado inicial
          clientId: client.id,
          assignedToId: admin.id, // Asignado al admin por defecto
          scheduledAt: scheduledDate, // Fechas distribuidas
          assignedAt: new Date(), // Marcar como asignado
          // description, postCopy, etc. pueden ir vacíos o con lorem ipsum
        },
      });
    }
  }

  // 6. Crear 2 Rodajes de Prueba (Para el Dashboard)
  const audisens = await prisma.client.findFirst({ where: { name: "Audisens" } });

  if (audisens) {
    // Rodaje 1: Mañana
    const tomorrow = addDays(today, 1);
    const tomorrowStart = new Date(tomorrow);
    tomorrowStart.setHours(14, 0, 0, 0); // 14:00
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(17, 0, 0, 0); // 17:00

    await prisma.shoot.create({
      data: {
        title: "Rodaje Mensual Audisens",
        clientId: audisens.id,
        startTime: tomorrowStart,
        endTime: tomorrowEnd,
        address: "Av. Principal 123, Loja",
        mapLink: "https://maps.google.com",
        notes: "Llevar micrófono de solapa extra.",
        status: "SCHEDULED",
        // Conectar al admin como crew
        crew: {
          connect: [{ id: admin.id }],
        },
      },
    });
    console.log(`🎥 Rodaje creado para mañana`);

    // Rodaje 2: En 3 días
    const inThreeDays = addDays(today, 3);
    const inThreeDaysStart = new Date(inThreeDays);
    inThreeDaysStart.setHours(10, 0, 0, 0); // 10:00
    const inThreeDaysEnd = new Date(inThreeDays);
    inThreeDaysEnd.setHours(13, 0, 0, 0); // 13:00

    await prisma.shoot.create({
      data: {
        title: "Rodaje TransCity - Campaña Q1",
        clientId: (await prisma.client.findFirst({ where: { name: "TransCity" } }))?.id || audisens.id,
        startTime: inThreeDaysStart,
        endTime: inThreeDaysEnd,
        address: "Terminal Terrestre, Loja",
        mapLink: "https://maps.google.com",
        notes: "Confirmar permisos de grabación con seguridad.",
        status: "SCHEDULED",
        crew: {
          connect: [{ id: admin.id }],
        },
      },
    });
    console.log(`🎥 Segundo rodaje creado para dentro de 3 días`);
  }

  console.log("✅ Seeding completado con éxito.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

