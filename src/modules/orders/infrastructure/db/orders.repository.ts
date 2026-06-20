import { OrdersRepository } from '@/modules/orders/domain/repositories/orders.repository.interface';
import { OrderStatus } from '@/modules/orders/domain/value-objects/order-status';
import { getDatabaseInstance } from '@/shared/infrastructure/db/kysely-client';
import { OrderNotificationAdapter } from '@/shared/infrastructure/notifications/order-notification.adapter';
import { sql } from 'kysely';

export class OrdersDbRepository implements OrdersRepository {
  async findById(id: number) {
    const db = await getDatabaseInstance();
    const result = await db.selectFrom('orders').selectAll().where('id', '=', id).executeTakeFirst();
    return result ?? null;
  }

  async findByUser(userId: number, limit = 20, offset = 0) {
    const db = await getDatabaseInstance();
    const countResult = await db
      .selectFrom('orders')
      .select(db.fn.countAll<number>().as('total'))
      .where('user_id', '=', userId)
      .executeTakeFirst();

    const orders = await db
      .selectFrom('orders')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    return { orders, total: Number(countResult?.total ?? 0) };
  }

  async findByIdempotencyKey(key: string) {
    const db = await getDatabaseInstance();
    const result = await db
      .selectFrom('orders')
      .select(['id', 'status', 'total', 'items', 'created_at'])
      .where('idempotency_key', '=', key)
      .executeTakeFirst();
    return result ?? null;
  }

  async create(data: {
    user_id: number;
    status: OrderStatus;
    total: number;
    items: string;
    idempotency_key: string;
  }): Promise<number> {
    const db = await getDatabaseInstance();
    const result = await db
      .insertInto('orders')
      .values({
        user_id: data.user_id,
        status: data.status,
        total: data.total,
        items: data.items,
        idempotency_key: data.idempotency_key,
        created_at: sql`NOW()`,
        updated_at: sql`NOW()`,
      })
      .executeTakeFirst();
    return Number(result.insertId);
  }

  async updateStatus(id: number, status: OrderStatus): Promise<void> {
    const db = await getDatabaseInstance();
    let fromStatus = 'UNKNOWN';

    await db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom('orders')
        .select('status')
        .where('id', '=', id)
        .executeTakeFirst();

      fromStatus = current?.status ?? 'UNKNOWN';

      await trx
        .updateTable('orders')
        .set({ status, updated_at: sql`NOW()` })
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
      fromStatus,
      toStatus: status,
      timestamp: new Date().toISOString(),
    });
  }

  async findAll(limit = 20, offset = 0, statusFilter?: OrderStatus) {
    const db = await getDatabaseInstance();
    let query = db.selectFrom('orders').selectAll();
    let countQuery = db.selectFrom('orders').select(db.fn.countAll<number>().as('total'));

    if (statusFilter) {
      query = query.where('status', '=', statusFilter);
      countQuery = countQuery.where('status', '=', statusFilter);
    }

    const countResult = await countQuery.executeTakeFirst();
    const orders = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    return { orders, total: Number(countResult?.total ?? 0) };
  }
}
