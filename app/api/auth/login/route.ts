import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'El correo electrónico y la contraseña son requeridos.' },
        { status: 400 }
      );
    }

    // Find user in database
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: {
        empresa: {
          include: {
            suscripcion: {
              include: {
                plan: true,
              },
            },
          },
        },
      },
    });

    if (!usuario || !usuario.activo) {
      return NextResponse.json(
        { error: 'Credenciales inválidas.' },
        { status: 401 }
      );
    }

    // Verify hashed password
    const isPasswordValid = verifyPassword(password, usuario.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Credenciales inválidas.' },
        { status: 401 }
      );
    }

    // Build session payload
    const sessionData = {
      userId: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol as any,
      empresaId: usuario.empresaId,
    };

    const response = NextResponse.json({
      success: true,
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        empresa: usuario.empresa
          ? {
              id: usuario.empresa.id,
              nombre: usuario.empresa.nombre,
              cuit: usuario.empresa.cuit,
              estado: usuario.empresa.estado,
              suscripcion: usuario.empresa.suscripcion
                ? {
                    plan: usuario.empresa.suscripcion.plan.nombre,
                    estado: usuario.empresa.suscripcion.estado,
                    vencimiento: usuario.empresa.suscripcion.fechaVencimiento,
                  }
                : null,
            }
          : null,
      },
    });

    // Write HTTP-only cookie
    await setSessionCookie(response, sessionData);

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error inesperado al iniciar sesión.' },
      { status: 500 }
    );
  }
}
