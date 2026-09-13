import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const empresas = await prisma.empresa.findMany({
      include: {
        usuarios: {
          select: { id: true, nombre: true, email: true, rol: true },
        },
        sucursales: {
          orderBy: { nombre: 'asc' },
        },
        suscripcion: {
          include: { plan: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(empresas);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
