import { PrismaClient } from "@prisma/client";

/**
 * Harness exclusivo para PostgreSQL efímero de integración.
 * Nunca debe ejecutarse contra una base de datos de desarrollo o producción.
 */
export const prisma = new PrismaClient();

function assertTestDatabase() {
  if (process.env.TOTEM_TEST_DATABASE !== "1") {
    throw new Error(
      "Refusing to mutate the database: set TOTEM_TEST_DATABASE=1 for integration tests."
    );
  }

  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
    throw new Error("Integration tests require a PostgreSQL DATABASE_URL.");
  }
}

/** Vacía todas las tablas de aplicación, conservando el historial de Prisma. */
export async function resetDatabase() {
  assertTestDatabase();
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE table_name text;
    BEGIN
      FOR table_name IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations'
      LOOP
        EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', table_name);
      END LOOP;
    END $$;
  `);
}

/** Fixtures pequeños y estables; los IDs evitan depender de cuid/clock/random. */
export async function seedTestDatabase() {
  assertTestDatabase();

  const admin = await prisma.user.create({
    data: {
      id: "cp02-admin",
      name: "CP02 Admin",
      email: "cp02-admin@totem.test",
      roleLegacy: "ADMIN",
    },
  });

  const editor = await prisma.user.create({
    data: {
      id: "cp02-editor",
      name: "CP02 Editor",
      email: "cp02-editor@totem.test",
      roleLegacy: "EDITOR",
    },
  });

  const client = await prisma.client.create({
    data: {
      id: "cp02-client",
      name: "Cliente CP02",
      status: "ACTIVE",
      color: "#2563eb",
      editorId: editor.id,
    },
  });

  const task = await prisma.contentTask.create({
    data: {
      id: "cp02-task",
      title: "Tarea de humo CP02",
      type: "REEL",
      status: "IDEA",
      clientId: client.id,
      assignedEditorId: editor.id,
    },
  });

  return { admin, editor, client, task };
}
