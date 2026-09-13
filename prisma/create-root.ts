/**
 * Crea (o reconfirma) el usuario ROOT sin tocar ningún otro dato.
 * Pensado para correr una sola vez contra la base de producción:
 *   DATABASE_URL="postgresql://..." npx ts-node prisma/create-root.ts
 */
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import readline from 'readline';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

async function main() {
  const email = (await ask('Email para tu usuario ROOT: ')).trim();
  const password = (await ask('Contraseña para ese usuario: ')).trim();
  const nombre = (await ask('Tu nombre (opcional, Enter para "Root"): ')).trim() || 'Root';

  if (!email || !password) {
    throw new Error('Email y contraseña son obligatorios.');
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
