import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ authenticated: false, session: null });
    }

    // For merchants, retrieve real-time company status, plan limits, and AFIP status
    if (session.rol !== 'SUPERADMIN' && session.empresaId) {
      const dbUser = await prisma.usuario.findUnique({
        where: { id: session.userId },
        include: {
          empresa: {
            include: {
              suscripcion: {
                include: {
                  plan: true,
                },
              },
              configAfip: true,
            },
          },
        },
      });

      if (dbUser) {
        return NextResponse.json({
          authenticated: true,
          session,
          user: {
            id: dbUser.id,
            nombre: dbUser.nombre,
            email: dbUser.email,
            rol: dbUser.rol,
            empresa: dbUser.empresa
              ? {
                  id: dbUser.empresa.id,
                  nombre: dbUser.empresa.nombre,
                  cuit: dbUser.empresa.cuit,
                  estado: dbUser.empresa.estado,
                  configAfip: dbUser.empresa.configAfip
                    ? {
                        modo: dbUser.empresa.configAfip.modo,
                        puntoVenta: dbUser.empresa.configAfip.puntoVenta,
                        hasCert: !!dbUser.empresa.configAfip.certificadoEncriptado,
                      }
                    : null,
                  suscripcion: dbUser.empresa.suscripcion
                    ? {
                        plan: dbUser.empresa.suscripcion.plan.nombre,
                        planId: dbUser.empresa.suscripcion.plan.id,
                        limiteVentas: dbUser.empresa.suscripcion.plan.limiteVentasMensuales,
                        limiteUsuarios: dbUser.empresa.suscripcion.plan.limiteUsuarios,
                        estado: dbUser.empresa.suscripcion.estado,
                        vencimiento: dbUser.empresa.suscripcion.fechaVencimiento,
                      }
                    : null,
                }
              : null,
          },
        });
      }
    }

    // Fallback for SUPERADMIN or if user not found in DB
    return NextResponse.json({
      authenticated: true,
      session,
      user: {
        id: session.userId,
        nombre: session.nombre,
        email: session.email,
        rol: session.rol,
        empresa: null,
      },
    });
  } catch (error: any) {
    console.error('Session API error:', error);
    return NextResponse.json(
      { error: 'Error checking session.' },
      { status: 500 }
    );
  }
}
