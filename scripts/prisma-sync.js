/* eslint-disable no-console */
/**
 * Sincroniza el esquema de Prisma con la base de datos de forma tolerante.
 * Si la base de datos no responde, NO rompe el build (aunque registra el error),
 * para no dejar la aplicación caída. El `prisma generate` (que sí corre siempre)
 * garantiza que el cliente Prisma coincida con el esquema.
 */
const { execSync } = require('child_process');

try {
  console.log('[prisma-sync] Sincronizando esquema con base de datos...');
  execSync('prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    env: process.env,
  });
  console.log('[prisma-sync] Base de datos sincronizada correctamente.');
} catch (err) {
  console.error('[prisma-sync] No se pudo sincronizar la base de datos:');
  console.error(err.message || err);
  console.log('[prisma-sync] Continuando el build (la sincronización de DB se reintentará o se hará manualmente).');
}
