import { Router } from 'express';
import { getUncachableStripeClient, getStripePublishableKey } from '../stripeClient';
import { requireAuth, type AuthRequest } from '../middlewares/auth';

const router = Router();

// GET /api/stripe/publishable-key
router.get('/stripe/publishable-key', async (_req, res) => {
  try {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stripe/products — lista planes con precios directamente de Stripe
router.get('/stripe/products', async (_req, res) => {
  try {
    const stripe = await getUncachableStripeClient();
    const products = await stripe.products.list({ active: true, limit: 20 });
    const prices = await stripe.prices.list({ active: true, limit: 50 });

    const result = products.data.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description ?? '',
      metadata: product.metadata ?? {},
      prices: prices.data
        .filter((p) => p.product === product.id)
        .map((p) => ({
          id: p.id,
          unit_amount: p.unit_amount ?? 0,
          currency: p.currency,
          recurring: p.recurring ? { interval: p.recurring.interval } : null,
        })),
    }));

    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stripe/status — ¿el dueño tiene acceso activo?
router.get('/stripe/status', requireAuth(['owner', 'admin']), async (_req: AuthRequest, res) => {
  try {
    // Por ahora sin DB sync, siempre retorna false (se implementa con webhook en producción)
    res.json({ hasAccess: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/checkout — crea sesión de pago
router.post('/stripe/checkout', requireAuth(['owner', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { priceId, mode } = req.body as { priceId: string; mode: 'subscription' | 'payment' };
    if (!priceId || !mode) {
      res.status(400).json({ error: 'priceId y mode requeridos' });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const domains = process.env.REPLIT_DOMAINS?.split(',')[0] ?? 'localhost';
    const baseUrl = `https://${domains}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: `${baseUrl}/?payment=success`,
      cancel_url: `${baseUrl}/?payment=cancelled`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
