import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const planes = await prisma.plan.findMany({
      orderBy: { precioMensual: 'asc' },
    });
    return NextResponse.json(planes);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
