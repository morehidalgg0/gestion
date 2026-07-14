import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // 1. Get token from cookies
  const token = req.cookies.get('session')?.value;
  
  // 2. If no token, redirect to login
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autenticado. Por favor inicie sesión.' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // 3. Verify JWT token
  const session = await verifyToken(token);
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Sesión inválida o expirada. Por favor inicie sesión de nuevo.' }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.delete('session'); // Clean corrupted session cookie
    return response;
  }

  // 4. Role Authorization
  // Superadmin routes require SUPERADMIN role
  if (pathname.startsWith('/superadmin') || pathname.startsWith('/api/superadmin')) {
    if (session.rol !== 'SUPERADMIN') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Acceso denegado. Se requiere rol de Superadmin.' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // Tenant/Merchant routes require OWNER or EMPLOYEE role
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/tenant')) {
    if (session.rol !== 'OWNER' && session.rol !== 'EMPLOYEE') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Acceso denegado. Se requiere rol de comercio.' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/login', req.url));
    }

    if (session.rol === 'EMPLOYEE') {
      const canAccessEmployeeDashboard =
        pathname === '/dashboard' ||
        pathname.startsWith('/dashboard/ventas') ||
        pathname.startsWith('/dashboard/comprobantes') ||
        pathname.startsWith('/dashboard/cierre-z') ||
        pathname.startsWith('/dashboard/productos');

      const canAccessEmployeeApi =
        (pathname === '/api/tenant/ventas' && (req.method === 'GET' || req.method === 'POST')) ||
        (pathname.startsWith('/api/tenant/ventas/') && req.method === 'GET') ||
        (pathname.endsWith('/nota-credito') && req.method === 'POST') ||
        (pathname === '/api/tenant/cierre-z' && (req.method === 'GET' || req.method === 'PUT' || req.method === 'POST')) ||
        (pathname.startsWith('/api/tenant/cierre-z/') && req.method === 'GET') ||
        (pathname === '/api/tenant/password' && req.method === 'PUT') ||
        (pathname === '/api/tenant/productos' && (req.method === 'GET' || req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE')) ||
        (pathname === '/api/tenant/clientes' && req.method === 'GET');

      if (pathname.startsWith('/dashboard') && !canAccessEmployeeDashboard) {
        return NextResponse.redirect(new URL('/dashboard/ventas', req.url));
      }

      if (pathname.startsWith('/api/tenant') && !canAccessEmployeeApi) {
        return NextResponse.json({ error: 'Acceso denegado. Se requiere rol administrador del comercio.' }, { status: 403 });
      }
    }

    // We can inject session headers for downstream routes/APIs to avoid re-decoding JWT
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', session.userId);
    requestHeaders.set('x-user-email', session.email);
    requestHeaders.set('x-user-rol', session.rol);
    requestHeaders.set('x-empresa-id', session.empresaId || '');
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

// Specify matching routes
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/superadmin/:path*',
    '/api/tenant/:path*',
    '/api/superadmin/:path*',
  ],
};
