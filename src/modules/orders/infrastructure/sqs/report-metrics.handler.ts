import { ScheduledHandler, EventBridgeEvent } from 'aws-lambda';
import { getDatabaseInstance } from '@/shared/infrastructure/db/kysely-client';
import logger from '@/shared/utils/logger.utils';
import { sql } from 'kysely';

export const reportMetrics: ScheduledHandler = async (_event: EventBridgeEvent<'Scheduled Event', unknown>) => {
  try {
    const db = await getDatabaseInstance();

    const totalOrders = await db
      .selectFrom('orders')
      .select(db.fn.countAll<number>().as('total'))
      .executeTakeFirst();

    const pendingOrders = await db
      .selectFrom('orders')
      .select(db.fn.countAll<number>().as('total'))
      .where('status', '=', 'PENDING')
      .executeTakeFirst();

    const completedToday = await db
      .selectFrom('orders')
      .select(db.fn.countAll<number>().as('total'))
      .where('status', '=', 'COMPLETED')
      .where(sql`DATE(created_at)`, '=', sql`CURDATE()`)
      .executeTakeFirst();

    logger.info({
      message: 'Metrics report',
      metrics: {
        totalOrders: Number(totalOrders?.total ?? 0),
        pendingOrders: Number(pendingOrders?.total ?? 0),
        completedToday: Number(completedToday?.total ?? 0),
      },
    });
  } catch (error) {
    logger.error({ error, message: 'Failed to generate metrics report' });
  }
};
