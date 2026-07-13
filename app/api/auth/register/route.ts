import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, setSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { cuit, razonSocial, condicionIva, nombre, email, password } = await req.json();

    if (!cuit || !razonSocial || !condicionIva || !nombre || !email || !password) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios para registrar la cuenta.' },
        { status: 400 }
      );
    }

    const cleanCuit = cuit.replace(/\D/g, '');
    if (cleanCuit.length !== 11) {
      return NextResponse.json({ error: 'El CUIT debe tener 11 dígitos numéricos.' }, { status: 400 });
    }

    // 1. Check duplicate email
    const existingUser = await prisma.usuario.findUnique({
      where: { email },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: 'El correo electrónico ya está registrado en la plataforma.' },
        { status: 400 }
      );
    }

    // 2. Check duplicate CUIT
    const existingEmpresa = await prisma.empresa.findUnique({
      where: { cuit: cleanCuit },
    });
    if (existingEmpresa) {
      return NextResponse.json(
        { error: 'El CUIT ya está registrado. Si eres empleado, solicita que te agreguen.' },
        { status: 400 }
      );
    }

    // 3. Create everything in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 3.1 Create Empresa
      const empresa = await tx.empresa.create({
        data: {
          nombre: razonSocial,
          cuit: cleanCuit,
          condicionIva,
          estado: 'PENDIENTE_PAGO', // Needs to complete payment onboarding
          configAfip: {
            create: {
              cuit: cleanCuit,
              razonSocial,
              condicionIva,
              puntoVenta: 1,
              modo: 'demo', // Defaults to demo mode
            },
          },
        },
      });

      // 3.2 Create default generic client "Consumidor Final" for POS
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

      // 3.3 Create OWNER User
      const passwordHash = hashPassword(password);
      const usuario = await tx.usuario.create({
        data: {
          nombre,
          email,
          passwordHash,
          rol: 'OWNER',
          empresaId: empresa.id,
        },
      });

      return { empresa, usuario };
    });

    const sessionData = {
      userId: result.usuario.id,
      nombre: result.usuario.nombre,
      email: result.usuario.email,
      rol: result.usuario.rol as any,
      empresaId: result.usuario.empresaId,
    };

    const response = NextResponse.json({
      success: true,
      empresaId: result.empresa.id,
      message: 'Comercio registrado con éxito. Redirigiendo a suscripción...',
    });

    // Automatically set session cookie for instant onboarding login
    await setSessionCookie(response, sessionData);

    return response;
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error al procesar el registro.' },
      { status: 500 }
    );
  }
}
