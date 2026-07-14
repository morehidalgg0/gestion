import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Self-contained password hashing for the seed runner
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('Seeding database...');

  // 1. Create Base Plans
  const plans = [
    {
      nombre: 'Prueba',
      precioMensual: 0.0,
      limiteVentasMensuales: 50,
      limiteUsuarios: 2,
    },
    {
      nombre: 'Básico',
      precioMensual: 15000.0,
      limiteVentasMensuales: 500,
      limiteUsuarios: 3,
    },
    {
      nombre: 'Premium',
      precioMensual: 30000.0,
      limiteVentasMensuales: 0, // 0 = sin límite
      limiteUsuarios: 999, // ilimitado lógicamente
    },
  ];

  const createdPlans = [];
  for (const planData of plans) {
    const existing = await prisma.plan.findFirst({
      where: { nombre: planData.nombre },
    });

    if (existing) {
      console.log(`Plan ${planData.nombre} already exists.`);
      createdPlans.push(existing);
    } else {
      const plan = await prisma.plan.create({
        data: planData,
      });
      console.log(`Created plan: ${plan.nombre}`);
      createdPlans.push(plan);
    }
  }

  // 2. Create SUPERADMIN User
  const adminEmail = 'superadmin@comerciopro.com';
  const existingAdmin = await prisma.usuario.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = hashPassword('admin123');
    await prisma.usuario.create({
      data: {
        nombre: 'Administrador del Sistema',
        email: adminEmail,
        passwordHash,
        rol: 'SUPERADMIN',
      },
    });
    console.log(`Created superadmin: ${adminEmail} (password: admin123)`);
  } else {
    console.log(`Superadmin already exists.`);
  }

  // 3. Create a Demo Empresa and its Owner User
  const demoCuit = '20409378472';
  const existingEmpresa = await prisma.empresa.findUnique({
    where: { cuit: demoCuit },
  });

  if (!existingEmpresa) {
    const empresa = await prisma.empresa.create({
      data: {
        nombre: 'Comercio Demo S.A.',
        cuit: demoCuit,
        condicionIva: 'Responsable Inscripto',
        estado: 'ACTIVO',
        configAfip: {
          create: {
            cuit: demoCuit,
            razonSocial: 'Comercio Demo S.A.',
            condicionIva: 'Responsable Inscripto',
            puntoVenta: 1,
            modo: 'demo', // Starts in internal demo mode by default
          },
        },
      },
    });
    console.log(`Created demo empresa: ${empresa.nombre}`);

    // Link subscription (Plan Básico, expires in 30 days)
    const basicPlan = createdPlans.find((p) => p.nombre === 'Básico');
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);

    await prisma.suscripcion.create({
      data: {
        empresaId: empresa.id,
        planId: basicPlan!.id,
        estado: 'authorized',
        fechaVencimiento: expiry,
      },
    });
    console.log('Linked basic plan subscription to demo empresa.');

    // Create Owner User for this Empresa
    const ownerEmail = 'demo@comerciopro.com';
    const ownerPasswordHash = hashPassword('demo123');
    await prisma.usuario.create({
      data: {
        nombre: 'Juan Pérez (Owner)',
        email: ownerEmail,
        passwordHash: ownerPasswordHash,
        rol: 'OWNER',
        empresaId: empresa.id,
      },
    });
    console.log(`Created owner user: ${ownerEmail} (password: demo123)`);

    // Create default items (Consumidor Final Genérico)
    const cf = await prisma.cliente.create({
      data: {
        empresaId: empresa.id,
        tipoDoc: '99',
        nroDoc: '0',
        razonSocial: 'Consumidor Final Genérico',
        condicionIva: 'Consumidor Final',
        saldoCuentaCorriente: 0,
      },
    });
    console.log(`Created default generic client: ${cf.razonSocial}`);

    // Create some initial products
    const products = [
      {
        codigo: '1001',
        nombre: 'Nueces Mariposa Peladas',
        categoria: 'Frutos Secos',
        unidad: 'kg',
        precioCosto: 4500.0,
        precioVenta: 7200.0,
        ivaPorcentaje: 21.0,
        stockActual: 12.5,
        stockMinimo: 5.0,
      },
      {
        codigo: '1002',
        nombre: 'Almendras Non Pareil',
        categoria: 'Frutos Secos',
        unidad: 'kg',
        precioCosto: 5800.0,
        precioVenta: 9500.0,
        ivaPorcentaje: 21.0,
        stockActual: 3.2, // Below stockMinimo
        stockMinimo: 5.0,
      },
      {
        codigo: '2001',
        nombre: 'Harina de Avena Integral',
        categoria: 'Harinas y Avena',
        unidad: 'kg',
        precioCosto: 1200.0,
        precioVenta: 1950.0,
        ivaPorcentaje: 10.5,
        stockActual: 25.0,
        stockMinimo: 10.0,
      },
      {
        codigo: '3001',
        nombre: 'Semillas de Chía Orgánicas',
        categoria: 'Semillas',
        unidad: 'g',
        precioCosto: 3.5,
        precioVenta: 6.0,
        ivaPorcentaje: 21.0,
        stockActual: 1500, // 1.5 kg
        stockMinimo: 500,
      },
      {
        codigo: '4001',
        nombre: 'Aceite de Coco Neutro 500ml',
        categoria: 'Aceites',
        unidad: 'unidad',
        precioCosto: 3800.0,
        precioVenta: 5600.0,
        ivaPorcentaje: 21.0,
        stockActual: 15.0,
        stockMinimo: 4.0,
      },
    ];

    for (const prod of products) {
      await prisma.producto.create({
        data: {
          empresaId: empresa.id,
          ...prod,
        },
      });
    }
    console.log('Seeded initial demo products.');
  } else {
    console.log('Demo empresa already exists.');
  }

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
