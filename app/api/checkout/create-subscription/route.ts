import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { createSubscriptionPreapproval } from '@/lib/mercadopago';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session || !session.empresaId) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const { planId } = await req.json();
    if (!planId) {
      return NextResponse.json({ error: 'ID de plan requerido.' }, { status: 400 });
    }

    // Find plan
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan no encontrado.' }, { status: 404 });
    }

    // Initiate payment preapproval (Mercado Pago link)
    const checkoutUrl = await createSubscriptionPreapproval({
      empresaId: session.empresaId,
      email: session.email,
      planNombre: plan.nombre,
      precio: plan.precioMensual.toNumber(),
    });

    return NextResponse.json({ success: true, checkoutUrl });
  } catch (error: any) {
    console.error('Subscription creation endpoint error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
