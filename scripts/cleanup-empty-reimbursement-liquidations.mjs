// Limpia las filas "Liquidación de N reembolso(s)" en $0 que dejaba la versión
// anterior a la 0.2.9 al liquidar sin nada pendiente. No cambian ningún total.
//
// Por defecto solo LISTA (no borra nada). Para borrar:
//   node scripts/cleanup-empty-reimbursement-liquidations.mjs --apply
// Las liquidaciones antiguas con monto distinto de $0 solo se muestran: se
// revisan a mano, nunca se borran desde aquí.
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();
const legacy = {
  type: "EXPENSE",
  category: "REIMBURSEMENT",
  description: { startsWith: "Liquidación de ", endsWith: " reembolso(s)" },
};

try {
  const rows = await prisma.transaction.findMany({
    where: legacy,
    select: { id: true, amount: true, description: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const empty = rows.filter((row) => row.amount === 0);
  const withAmount = rows.filter((row) => row.amount !== 0);

  console.log(`Liquidaciones antiguas en $0: ${empty.length}`);
  for (const row of empty) console.log(`  ${row.createdAt.toISOString()}  ${row.description}`);
  console.log(`Liquidaciones antiguas con monto (no se tocan): ${withAmount.length}`);
  for (const row of withAmount) console.log(`  ${row.createdAt.toISOString()}  $${row.amount}  ${row.description}`);

  if (apply && empty.length > 0) {
    const { count } = await prisma.transaction.deleteMany({
      where: { ...legacy, amount: 0, id: { in: empty.map((row) => row.id) } },
    });
    console.log(`Borradas: ${count}`);
  } else if (!apply) {
    console.log("Modo revisión: no se borró nada. Usa --apply para borrar las de $0.");
  }
} finally {
  await prisma.$disconnect();
}
