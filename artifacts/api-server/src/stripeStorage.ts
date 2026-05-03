import { sql } from 'drizzle-orm';
import { db } from '@workspace/db';

export class StripeStorage {
  async listProductsWithPrices() {
    const result = await db.execute(sql`
      WITH paginated_products AS (
        SELECT id, name, description, metadata, active
        FROM stripe.products
        WHERE active = true
        ORDER BY id
      )
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.description as product_description,
        p.active as product_active,
        p.metadata as product_metadata,
        pr.id as price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring,
        pr.active as price_active
      FROM paginated_products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      ORDER BY p.id, pr.unit_amount
    `);
    return result.rows;
  }

  async getCustomerByOwnerId(ownerId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.customers WHERE metadata->>'ownerId' = ${ownerId} LIMIT 1`
    );
    return result.rows[0] || null;
  }

  async getActiveSubscriptionByCustomerId(customerId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE customer = ${customerId} AND status IN ('active','trialing') LIMIT 1`
    );
    return result.rows[0] || null;
  }

  async getCompletedPaymentByCustomerId(customerId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.payment_intents WHERE customer = ${customerId} AND status = 'succeeded' LIMIT 1`
    );
    return result.rows[0] || null;
  }
}

export const stripeStorage = new StripeStorage();
