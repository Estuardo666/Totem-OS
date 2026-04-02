import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const players = await db.oneSignalPlayer.findMany({
    select: { userId: true, playerId: true, device: true, browser: true, subscribed: true, lastSeen: true, createdAt: true }
  });
  console.log("Total players en BD:", players.length);

  const users = await db.user.findMany({
    select: { id: true, name: true, email: true, roleLegacy: true }
  });
  console.log("Usuarios en sistema:", users.length);

  console.log("\n=== ESTADO POR USUARIO ===");
  for (const user of users) {
    const userPlayers = players.filter(p => p.userId === user.id);
    if (userPlayers.length === 0) {
      console.log(`❌ SIN PUSH: ${user.name} (${user.email}) [${user.roleLegacy}]`);
    } else {
      const details = userPlayers.map(x => `${x.device}/${x.browser} subscribed=${x.subscribed} lastSeen=${x.lastSeen?.toISOString().slice(0,10)}`).join(" | ");
      console.log(`✅ CON PUSH: ${user.name} (${user.email}) [${user.role}] — ${details}`);
    }
  }

  console.log("\n=== PLAYERS SIN USUARIO VINCULADO ===");
  const orphans = players.filter(p => !p.userId);
  console.log(`Orphan players: ${orphans.length}`);
  orphans.forEach(p => console.log(` - playerId=${p.playerId} device=${p.device}`));
}

main().finally(() => db.$disconnect());
