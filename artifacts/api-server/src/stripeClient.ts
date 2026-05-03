import Stripe from 'stripe';

async function getSecretKey(): Promise<string> {
  // Primero intenta usar la variable de entorno directa (Render, producción)
  if (process.env.STRIPE_SECRET_KEY) {
    return process.env.STRIPE_SECRET_KEY;
  }

  // Fallback: obtiene la clave desde el conector de Replit (desarrollo local)
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error('Stripe no configurado. Agregá STRIPE_SECRET_KEY como variable de entorno.');
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', 'stripe');
  url.searchParams.set('environment', targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json', 'X-Replit-Token': xReplitToken },
    signal: AbortSignal.timeout(10_000),
  });

  const data = await response.json();
  const settings = data.items?.[0]?.settings;

  if (!settings?.secret) {
    throw new Error('Stripe no configurado. Conectá Stripe en Integraciones o agregá STRIPE_SECRET_KEY.');
  }

  return settings.secret;
}

async function getPublishableKey(): Promise<string> {
  // Primero intenta usar la variable de entorno directa
  if (process.env.STRIPE_PUBLISHABLE_KEY) {
    return process.env.STRIPE_PUBLISHABLE_KEY;
  }

  // Fallback: obtiene la clave desde el conector de Replit
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error('STRIPE_PUBLISHABLE_KEY no configurada.');
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', 'stripe');
  url.searchParams.set('environment', targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json', 'X-Replit-Token': xReplitToken },
    signal: AbortSignal.timeout(10_000),
  });

  const data = await response.json();
  const settings = data.items?.[0]?.settings;
  if (!settings?.publishable) throw new Error('STRIPE_PUBLISHABLE_KEY no configurada.');
  return settings.publishable;
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const secretKey = await getSecretKey();
  return new Stripe(secretKey, { apiVersion: '2025-08-27.basil' as any });
}

export async function getStripePublishableKey(): Promise<string> {
  return getPublishableKey();
}
