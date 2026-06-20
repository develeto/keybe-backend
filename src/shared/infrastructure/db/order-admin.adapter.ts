import { OrderAdminPort } from '@/shared/domain/ports/order-admin.port';
import { getDatabaseInstance } from '@/shared/infrastructure/db/kysely-client';
import { OrderNotificationAdapter } from '@/shared/infrastructure/notifications/order-notification.adapter';
import { sql } from 'kysely';

export class OrderAdminAdapter implements OrderAdminPort {
  async findAll(limit = 20, offset = 0, statusFilter?: string) {
    const db = await getDatabaseInstance();
    let query = db.selectFrom('orders').selectAll();
    let countQuery = db.selectFrom('orders').select(db.fn.countAll<number>().as('total'));

    if (statusFilter) {
      query = query.where('status', '=', statusFilter as any);
      countQuery = countQuery.where('status', '=', statusFilter as any);
    }

    const countResult = await countQuery.executeTakeFirst();
    const orders = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    return { orders, total: Number(countResult?.total ?? 0) };
  }

  async findById(id: number) {
    const db = await getDatabaseInstance();
    const result = await db
      .selectFrom('orders')
      .select(['id', 'status', 'items'])
      .where('id', '=', id)
      .executeTakeFirst();

    if (!result) return null;
    return { id: result.id, status: result.status as string, items: result.items };
  }

  async updateStatus(id: number, status: string): Promise<void> {
    const db = await getDatabaseInstance();
    let fromStatus = 'UNKNOWN';

    await db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom('orders')
        .select('status')
        .where('id', '=', id)
        .executeTakeFirst();

      fromStatus = current?.status as string ?? 'UNKNOWN';

      await trx
        .updateTable('orders')
        .set({ status: status as any, updated_at: sql`NOW()` })
        .where('id', '=', id)
        .execute();

      await trx
        .insertInto('order_status_history')
        .values({
          order_id: id,
          from_status: fromStatus,
          to_status: status,
          created_at: sql`NOW()`,
        })
        .execute();
    });

    const notifier = new OrderNotificationAdapter();
    await notifier.notifyStatusChanged({
      orderId: id,
      fromStatus: fromStatus,
      toStatus: status,
      timestamp: new Date().toISOString(),
    });
  }
}
