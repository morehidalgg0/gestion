/**
 * Crea el usuario ROOT sin tocar ningún otro dato.
 * Uso:
 *   DATABASE_URL="postgresql://..." npx ts-node prisma/create-root.ts <email> <password> ["Nombre"]
 */
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  const [, , email, password, nombre = 'Root'] = process.argv;

  if (!email || !password) {
    throw new Error('Uso: npx ts-node prisma/create-root.ts <email> <password> ["Nombre"]');
  }

  const existing = await prisma.usuario.findUnique({ where: { email } });
  if (existing) {
    throw new Error(`Ya existe un usuario con ese email (rol actual: ${existing.rol}).`);
  }

  const passwordHash = hashPassword(password);
  await prisma.usuario.create({
    data: { nombre, email, passwordHash, rol: 'ROOT' },
  });

  console.log(`Usuario ROOT creado: ${email}`);
}

main()
  .catch((e) => {
    console.error('Error:', e.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
