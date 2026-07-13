import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPreapprovalDetails } from '@/lib/mercadopago';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    
    console.log('Received Mercado Pago Webhook:', JSON.stringify(body));

    // 1. DEMO MODE WEBHOOK SIMULATOR TRIGGER
    if (process.env.DEMO_MODE === 'true' && body.isDemoTrigger) {
      const { empresaId, planId, status, preapprovalId } = body;
      
      const empresa = await prisma.empresa.findUnique({
        where: { id: empresaId },
      });
      
      if (!empresa) {
        return NextResponse.json({ error: 'Empresa no encontrada.' }, { status: 404 });
      }

      // Calculate expiration: 30 days from now
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);

      // Create or update subscription
      await prisma.suscripcion.upsert({
        where: { empresaId },
        update: {
          planId,
          mpPreapprovalId: preapprovalId || `demo-preapproval-${Math.floor(1000 + Math.random() * 9000)}`,
          estado: status || 'authorized',
          fechaVencimiento: expiry,
        },
        create: {
          empresaId,
          planId,
          mpPreapprovalId: preapprovalId || `demo-preapproval-${Math.floor(1000 + Math.random() * 9000)}`,
          estado: status || 'authorized',
          fechaVencimiento: expiry,
        },
      });

      // Update Empresa state
      await prisma.empresa.update({
        where: { id: empresaId },
        data: {
          estado: status === 'authorized' ? 'ACTIVO' : 'PENDIENTE_PAGO',
        },
      });

      console.log(`Demo Webhook Simulated: Empresa ${empresaId} activated under Plan ${planId}.`);
      return NextResponse.json({ success: true, message: 'Demo webhook trigger processed successfully.' });
    }

    // 2. REAL MERCADO PAGO WEBHOOK PROCESSING
    const { action, type, data } = body;

    // Mercado Pago subscription notification
    if (type === 'subscription_preapproval' || type === 'preapproval') {
      const preapprovalId = data?.id;
      if (!preapprovalId) {
        return NextResponse.json({ error: 'Missing preapproval ID in notification.' }, { status: 400 });
      }

      // Fetch preapproval details from MP
      const details = await getPreapprovalDetails(preapprovalId);
      const empresaId = details.external_reference;

      if (!empresaId) {
        return NextResponse.json({ error: 'No external_reference (empresaId) found in payment details.' }, { status: 200 });
      }

      const empresa = await prisma.empresa.findUnique({
        where: { id: empresaId },
      });

      if (!empresa) {
        return NextResponse.json({ error: 'Empresa matching external_reference not found.' }, { status: 200 });
      }

      const status = details.status; // 'authorized' (active), 'paused', 'cancelled', 'pending'
      
      // Determine expiration date
      let nextPaymentDate = new Date();
      if (details.next_payment_date) {
        nextPaymentDate = new Date(details.next_payment_date);
      } else {
        // Fallback: 30 days
        nextPaymentDate.setDate(nextPaymentDate.getDate() + 30);
      }

      // Load Básico plan fallback in case they do not have a subscription set up
      let planId = '';
      const existingSub = await prisma.suscripcion.findUnique({
        where: { empresaId },
      });

      if (existingSub) {
        planId = existingSub.planId;
      } else {
        const basicPlan = await prisma.plan.findFirst({
          where: { nombre: 'Básico' },
        });
        planId = basicPlan?.id || '';
      }

      // Update Database
      await prisma.suscripcion.upsert({
        where: { empresaId },
        update: {
          mpPreapprovalId: preapprovalId,
          estado: status,
          fechaVencimiento: nextPaymentDate,
        },
        create: {
          empresaId,
          planId,
          mpPreapprovalId: preapprovalId,
          estado: status,
          fechaVencimiento: nextPaymentDate,
        },
      });

      // Update Empresa activation status
      await prisma.empresa.update({
        where: { id: empresaId },
        data: {
          estado: status === 'authorized' ? 'ACTIVO' : 'INACTIVO',
        },
      });

      console.log(`Real Webhook Processed: Empresa ${empresaId} updated to ${status}. Expiry: ${nextPaymentDate.toISOString()}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Webhook route error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
