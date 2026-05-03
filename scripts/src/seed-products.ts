import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();
    console.log('Creando productos en Stripe...');

    // --- Plan Mensual ---
    const existingMonthly = await stripe.products.search({
      query: "name:'Valet Ops - Suscripción Mensual' AND active:'true'"
    });
    let monthlyProduct;
    if (existingMonthly.data.length > 0) {
      console.log('Plan mensual ya existe, omitiendo creación.');
      monthlyProduct = existingMonthly.data[0];
    } else {
      monthlyProduct = await stripe.products.create({
        name: 'Valet Ops - Suscripción Mensual',
        description: 'Acceso completo a Valet Ops. Eventos ilimitados, turnos y tickets.',
        metadata: { type: 'subscription', interval: 'month' },
      });
      await stripe.prices.create({
        product: monthlyProduct.id,
        unit_amount: 2900,
        currency: 'usd',
        recurring: { interval: 'month' },
      });
      console.log(`Creado plan mensual: ${monthlyProduct.id}`);
    }

    // --- Pago por Evento ---
    const existingEvent = await stripe.products.search({
      query: "name:'Valet Ops - Pago por Evento' AND active:'true'"
    });
    if (existingEvent.data.length > 0) {
      console.log('Pago por evento ya existe, omitiendo creación.');
    } else {
      const eventProduct = await stripe.products.create({
        name: 'Valet Ops - Pago por Evento',
        description: 'Acceso a Valet Ops por un solo evento. Sin compromiso.',
        metadata: { type: 'one_time' },
      });
      await stripe.prices.create({
        product: eventProduct.id,
        unit_amount: 999,
        currency: 'usd',
      });
      console.log(`Creado pago por evento: ${eventProduct.id}`);
    }

    console.log('✓ Productos creados exitosamente en Stripe.');
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createProducts();
