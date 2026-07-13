export interface SubscriptionRequest {
  empresaId: string;
  email: string;
  planNombre: string;
  precio: number;
}

const MP_API_URL = 'https://api.mercadopago.com';

/**
 * Gets the base URL of the application.
 */
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  return 'http://localhost:3000';
}

/**
 * Initiates a Mercado Pago subscription link (preapproval).
 * If DEMO_MODE=true, it redirects to a local simulated checkout.
 */
export async function createSubscriptionPreapproval({
  empresaId,
  email,
  planNombre,
  precio,
}: SubscriptionRequest): Promise<string> {
  const isDemo = process.env.DEMO_MODE === 'true';

  if (isDemo) {
    // Return local simulated checkout page url
    const params = new URLSearchParams({
      empresaId,
      email,
      plan: planNombre,
      precio: precio.toString(),
      demo: 'true',
    });
    return `/checkout/demo?${params.toString()}`;
  }

  const mpToken = process.env.MP_ACCESS_TOKEN;
  if (!mpToken) {
    throw new Error(
      'CRITICAL: MP_ACCESS_TOKEN environment variable is missing. Subscription payments cannot be processed.'
    );
  }

  const baseUrl = getBaseUrl();

  try {
    const response = await fetch(`${MP_API_URL}/v1/preapproval`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mpToken}`,
      },
      body: JSON.stringify({
        back_url: `${baseUrl}/checkout/feedback`,
        reason: `Suscripción mensual - Plan ${planNombre}`,
        external_reference: empresaId,
        payer_email: email,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: precio,
          currency_id: 'ARS',
        },
        status: 'pending',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Mercado Pago preapproval error: ${errorData.message || response.statusText}`
      );
    }

    const data = await response.json();
    
    // Return the initiation link for checkout redirection
    if (!data.init_point) {
      throw new Error('Mercado Pago API failed to return init_point URL.');
    }
    
    return data.init_point;
  } catch (error: any) {
    console.error('Failed to create MP subscription preapproval:', error);
    throw new Error(`Mercado Pago Subscription creation failed: ${error.message}`);
  }
}

/**
 * Fetches subscription details from Mercado Pago using the preapproval ID.
 */
export async function getPreapprovalDetails(preapprovalId: string): Promise<any> {
  const isDemo = process.env.DEMO_MODE === 'true';
  if (isDemo) {
    // Dummy demo data
    return {
      id: preapprovalId,
      status: 'authorized',
      external_reference: 'demo-tenant-id',
      payer_email: 'demo@dietetica.com',
      reason: 'Suscripción mensual - Plan Básico',
    };
  }

  const mpToken = process.env.MP_ACCESS_TOKEN;
  if (!mpToken) {
    throw new Error('CRITICAL: MP_ACCESS_TOKEN environment variable is missing.');
  }

  try {
    const response = await fetch(`${MP_API_URL}/v1/preapproval/${preapprovalId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${mpToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Mercado Pago API error fetching preapproval: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('Failed to get MP subscription details:', error);
    throw new Error(`Failed to verify payment with Mercado Pago: ${error.message}`);
  }
}
