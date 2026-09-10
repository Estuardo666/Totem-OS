/**
 * Cifra los tokens que todavía están en texto plano.
 *
 * Idempotente: los valores ya cifrados llevan el prefijo `v1:` y se saltan, así
 * que se puede volver a correr sin riesgo. Se ejecuta a mano una vez tras el
 * despliegue — nunca en un cron.
 *
 *   node --experimental-strip-types scripts/backfill-token-encryption.mjs
 *
 * Solo registra conteos: un token nunca debe aparecer en un log.
 */

import nextEnv from '@next/env';
import { PrismaClient } from '@prisma/client';

nextEnv.loadEnvConfig(process.cwd());

const { encryptToken, isEncrypted } = await import('../src/lib/crypto/token-cipher.ts');

const db = new PrismaClient();

async function backfillAgencyTokens() {
  const accounts = await db.agencyMetaAccount.findMany({
    select: { id: true, accessToken: true },
  });

  let encrypted = 0;
  for (const account of accounts) {
    if (isEncrypted(account.accessToken)) continue;
    await db.agencyMetaAccount.update({
      where: { id: account.id },
      data: { accessToken: encryptToken(account.accessToken) },
    });
    encrypted++;
  }

  return { total: accounts.length, encrypted };
}

async function backfillClientPageTokens() {
  const clients = await db.client.findMany({
    where: { pageAccessToken: { not: null } },
    select: { id: true, pageAccessToken: true },
  });

  let encrypted = 0;
  for (const client of clients) {
    if (isEncrypted(client.pageAccessToken)) continue;
    await db.client.update({
      where: { id: client.id },
      data: { pageAccessToken: encryptToken(client.pageAccessToken) },
    });
    encrypted++;
  }

  return { total: clients.length, encrypted };
}

async function main() {
  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    console.error(
      'Falta TOKEN_ENCRYPTION_KEY. Genérala con:\n' +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
    process.exitCode = 1;
    return;
  }

  const agency = await backfillAgencyTokens();
  const clients = await backfillClientPageTokens();

  console.log(`AgencyMetaAccount: ${agency.encrypted} cifradas de ${agency.total}`);
  console.log(`Client.pageAccessToken: ${clients.encrypted} cifrados de ${clients.total}`);

  const pending = agency.total - agency.encrypted + (clients.total - clients.encrypted);
  console.log(
    pending === 0
      ? 'Nada quedó en texto plano.'
      : `${pending} ya estaban cifrados y se saltaron.`
  );
}

main()
  .catch((error) => {
    console.error('El backfill falló:', error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
