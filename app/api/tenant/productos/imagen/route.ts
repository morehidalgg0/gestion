import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

function getTenantId(req: Request): string {
  const empresaId = req.headers.get('x-empresa-id');
  if (!empresaId) {
    throw new Error('Tenant context is missing.');
  }
  return empresaId;
}

// POST /api/tenant/productos/imagen
// Generates a client-upload token for a product image via Vercel Blob.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    // AuthZ already happens in the middleware (x-empresa-id header injected).
    const empresaId = getTenantId(request);

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let productoId: string | undefined;
        if (clientPayload) {
          try {
            const parsed = JSON.parse(clientPayload);
            productoId = parsed?.productoId;
          } catch {
            // ignore
          }
        }

        if (!productoId) {
          throw new Error('productoId es requerido.');
        }

        // Only allow image content types
        return {
          access: 'public',
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          tokenPayload: JSON.stringify({ empresaId, productoId }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
