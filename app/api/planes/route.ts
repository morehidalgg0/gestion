import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const planes = await prisma.plan.findMany({
      orderBy: {
        precioMensual: 'asc',
      },
    });
    
    return NextResponse.json(planes);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al obtener los planes.' }, { status: 500 });
  }
}
