import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';

function getTenantId(req: NextRequest): string {
  const empresaId = req.headers.get('x-empresa-id');
  if (!empresaId) {
    throw new Error('Tenant context is missing.');
  }
  return empresaId;
}

export async function GET(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);
    const usuarios = await prisma.usuario.findMany({
      where: { empresaId },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
      },
      orderBy: { nombre: 'asc' },
    });
    return NextResponse.json(usuarios);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const empresaId = getTenantId(req);

    // 1. Fetch company and subscription details
    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      include: {
        suscripcion: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!empresa) {
      return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });
    }

    const plan = empresa.suscripcion?.plan;
    if (!plan) {
      return NextResponse.json({ error: 'Suscripción no activa o no encontrada.' }, { status: 403 });
    }

    // 2. Check Plan Limit: Max Users
    const userCount = await prisma.usuario.count({
      where: { empresaId },
    });

    if (userCount >= plan.limiteUsuarios) {
      return NextResponse.json(
        {
          error: `Has superado el límite de usuarios de tu plan (${plan.limiteUsuarios} usuarios). Por favor, actualiza tu plan para agregar más personal.`,
        },
        { status: 403 }
      );
    }

    // Parse input
    const { nombre, email, password, rol } = await req.json();

    if (!nombre || !email || !password || !rol) {
      return NextResponse.json({ error: 'Faltan campos obligatorios para crear el usuario.' }, { status: 400 });
    }

    if (rol !== 'OWNER' && rol !== 'EMPLOYEE') {
      return NextResponse.json({ error: 'Rol inválido. Debe ser OWNER o EMPLOYEE.' }, { status: 400 });
    }

    // Check duplicate email system-wide
    const existing = await prisma.usuario.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json({ error: 'El correo electrónico ya está registrado.' }, { status: 400 });
    }

    // Hash password and create user
    const passwordHash = hashPassword(password);
    const usuario = await prisma.usuario.create({
      data: {
        empresaId,
        nombre,
        email,
        passwordHash,
        rol,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
      },
    });

    return NextResponse.json(usuario);
  } catch (error: any) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
