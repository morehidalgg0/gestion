import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';

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
        pagos: {
          orderBy: { fecha: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(empresas);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      nombre,
      cuit,
      condicionIva,
      planId,
      fechaVencimiento,
      estado,
      ownerNombre,
      ownerEmail,
      ownerPassword,
    } = await req.json();

    if (!nombre || !cuit || !condicionIva || !planId || !fechaVencimiento || !ownerNombre || !ownerEmail || !ownerPassword) {
      return NextResponse.json({ error: 'Faltan campos obligatorios.' }, { status: 400 });
    }

    const cleanCuit = String(cuit).replace(/\D/g, '');
    if (cleanCuit.length !== 11) {
      return NextResponse.json({ error: 'El CUIT debe tener 11 dígitos numéricos.' }, { status: 400 });
    }

    if (ownerPassword.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
    }

    const [existingEmpresa, existingUsuario] = await Promise.all([
      prisma.empresa.findUnique({ where: { cuit: cleanCuit } }),
      prisma.usuario.findUnique({ where: { email: ownerEmail } }),
    ]);

    if (existingEmpresa) {
      return NextResponse.json({ error: 'Ya existe una empresa registrada con ese CUIT.' }, { status: 409 });
    }
    if (existingUsuario) {
      return NextResponse.json({ error: 'Ya existe un usuario con ese email.' }, { status: 409 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: {
          nombre,
          cuit: cleanCuit,
          condicionIva,
          estado: estado || 'ACTIVO',
          configAfip: {
            create: {
              cuit: cleanCuit,
              razonSocial: nombre,
              condicionIva,
              puntoVenta: 1,
              modo: 'demo',
            },
          },
        },
      });

      await tx.cliente.create({
        data: {
          empresaId: empresa.id,
          tipoDoc: '99',
          nroDoc: '0',
          razonSocial: 'Consumidor Final Genérico',
          condicionIva: 'Consumidor Final',
          saldoCuentaCorriente: 0,
        },
      });

      await tx.suscripcion.create({
        data: {
          empresaId: empresa.id,
          planId,
          estado: 'authorized',
          fechaVencimiento: new Date(fechaVencimiento),
        },
      });

      const owner = await tx.usuario.create({
        data: {
          nombre: ownerNombre,
          email: ownerEmail,
          passwordHash: hashPassword(ownerPassword),
          rol: 'OWNER',
          empresaId: empresa.id,
        },
      });

      return { empresa, owner };
    });

    return NextResponse.json({ success: true, empresaId: result.empresa.id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, estado, planId, fechaVencimiento, mensajeAviso } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID de empresa requerido.' }, { status: 400 });
    }

    const empresaUpdate: any = {};
    if (estado) empresaUpdate.estado = estado;
    if (mensajeAviso !== undefined) empresaUpdate.mensajeAviso = mensajeAviso ? mensajeAviso.trim() || null : null;

    const empresa = await prisma.empresa.update({
      where: { id },
      data: empresaUpdate,
    });

    if (planId || fechaVencimiento) {
      const sub = await prisma.suscripcion.findUnique({ where: { empresaId: id } });

      const subUpdate: any = {};
      if (planId) subUpdate.planId = planId;
      if (fechaVencimiento) subUpdate.fechaVencimiento = new Date(fechaVencimiento);

      if (sub) {
        await prisma.suscripcion.update({ where: { empresaId: id }, data: subUpdate });
      } else if (planId && fechaVencimiento) {
        await prisma.suscripcion.create({
          data: {
            empresaId: id,
            planId,
            estado: 'authorized',
            fechaVencimiento: new Date(fechaVencimiento),
          },
        });
      }
    }

    return NextResponse.json({ success: true, empresa });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
