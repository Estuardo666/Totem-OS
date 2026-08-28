import { prisma, resetDatabase, seedTestDatabase } from "./prisma-test-db.mjs";

try {
  await resetDatabase();
  const fixtures = await seedTestDatabase();
  console.log(
    JSON.stringify(
      {
        seed: "cp02",
        userIds: [fixtures.admin.id, fixtures.editor.id],
        clientId: fixtures.client.id,
        taskId: fixtures.task.id,
      },
      null,
      2
    )
  );
} finally {
  await prisma.$disconnect();
}
