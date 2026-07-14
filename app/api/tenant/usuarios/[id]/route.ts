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

function getUserId(req: NextRequest): string {
  const userId = req.headers.get('x-user-id');
  if (!userId) {
    throw new Error('User context is missing.');
  }
  return userId;
}

function getRole(req: NextRequest): string {
  return req.headers.get('x-user-rol') || '';
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (getRole(req) !== 'OWNER') {
      return NextResponse.json({ error: 'Solo el administrador puede modificar usuarios.' }, { status: 403 });
    }

    const empresaId = getTenantId(req);
    const currentUserId = getUserId(req);
    const { id } = await params;
    const { nombre, email, rol, password, activo } = await req.json();

    const usuario = await prisma.usuario.findFirst({
      where: { id, empresaId },
    });

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    if (rol && rol !== 'OWNER' && rol !== 'EMPLOYEE') {
      return NextResponse.json({ error: 'Rol inválido. Debe ser OWNER o EMPLOYEE.' }, { status: 400 });
    }

    if (email && email !== usuario.email) {
      const existing = await prisma.usuario.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json({ error: 'El correo electrónico ya está registrado.' }, { status: 400 });
      }
    }

    if (password && password.length < 6) {
      return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
    }

    if (typeof activo === 'boolean' && !activo && id === currentUserId) {
      return NextResponse.json({ error: 'No podés darte de baja a vos mismo.' }, { status: 400 });
    }

    const activeOwners = await prisma.usuario.count({
      where: { empresaId, rol: 'OWNER', activo: true },
    });

    const wouldStopBeingActiveOwner = usuario.rol === 'OWNER' && usuario.activo && (rol === 'EMPLOYEE' || activo === false);
    if (wouldStopBeingActiveOwner && activeOwners <= 1) {
      return NextResponse.json({ error: 'Debe quedar al menos un administrador activo.' }, { status: 400 });
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data: {
        nombre: nombre || usuario.nombre,
        email: email || usuario.email,
        rol: rol || usuario.rol,
        activo: typeof activo === 'boolean' ? activo : usuario.activo,
        ...(password ? { passwordHash: hashPassword(password) } : {}),
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

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (getRole(req) !== 'OWNER') {
      return NextResponse.json({ error: 'Solo el administrador puede dar de baja usuarios.' }, { status: 403 });
    }

    const empresaId = getTenantId(req);
    const currentUserId = getUserId(req);
    const { id } = await params;

    if (id === currentUserId) {
      return NextResponse.json({ error: 'No podés darte de baja a vos mismo.' }, { status: 400 });
    }

    const usuario = await prisma.usuario.findFirst({
      where: { id, empresaId },
    });

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    const activeOwners = await prisma.usuario.count({
      where: { empresaId, rol: 'OWNER', activo: true },
    });

    if (usuario.rol === 'OWNER' && activeOwners <= 1) {
      return NextResponse.json({ error: 'No se puede dar de baja al último administrador activo.' }, { status: 400 });
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data: { activo: false },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Deactivate user error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
