import { MetricsRepository, OrderMetrics } from '../../domain/repositories/metrics.repository.interface';
import { Kysely, sql } from 'kysely';
import type { OrderFlowDatabase } from '@/shared/infrastructure/db/models';

export class MetricsDbRepository implements MetricsRepository {
  constructor(private readonly db: Kysely<OrderFlowDatabase>) {}

  async getOrderMetrics(): Promise<OrderMetrics> {
    const totalOrders = await this.db
      .selectFrom('orders')
      .select(this.db.fn.countAll<number>().as('total'))
      .executeTakeFirst();

    const pendingOrders = await this.db
      .selectFrom('orders')
      .select(this.db.fn.countAll<number>().as('total'))
      .where('status', '=', 'PENDING')
      .executeTakeFirst();

    const completedToday = await this.db
      .selectFrom('orders')
      .select(this.db.fn.countAll<number>().as('total'))
      .where('status', '=', 'COMPLETED')
      .where(sql`DATE(created_at)`, '=', sql`CURDATE()`)
      .executeTakeFirst();

    return {
      totalOrders: Number(totalOrders?.total ?? 0),
      pendingOrders: Number(pendingOrders?.total ?? 0),
      completedToday: Number(completedToday?.total ?? 0),
    };
  }
}
