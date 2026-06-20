import { OrdersRepository } from '@/modules/orders/domain/repositories/orders.repository.interface';
import { OrderStatus } from '@/modules/orders/domain/value-objects/order-status';
import { Kysely, sql } from 'kysely';
import type { OrderFlowDatabase } from '@/shared/infrastructure/db/models';

export class OrdersDbRepository implements OrdersRepository {
  constructor(private readonly db: Kysely<OrderFlowDatabase>) {}

  async findById(id: number) {
    const result = await this.db.selectFrom('orders').selectAll().where('id', '=', id).executeTakeFirst();
    return result ?? null;
  }

  async findByUser(userId: number, limit = 20, offset = 0) {
    const countResult = await this.db
      .selectFrom('orders')
      .select(this.db.fn.countAll<number>().as('total'))
      .where('user_id', '=', userId)
      .executeTakeFirst();

    const orders = await this.db
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
    const result = await this.db
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
    const result = await this.db
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
    await this.db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom('orders')
        .select('status')
        .where('id', '=', id)
        .executeTakeFirst();

      await trx
        .updateTable('orders')
        .set({ status, updated_at: sql`NOW()` })
        .where('id', '=', id)
        .execute();

      await trx
        .insertInto('order_status_history')
        .values({
          order_id: id,
          from_status: current?.status ?? 'UNKNOWN',
          to_status: status,
          created_at: sql`NOW()`,
        })
        .execute();
    });
  }

  async findAll(limit = 20, offset = 0, statusFilter?: OrderStatus) {
    let query = this.db.selectFrom('orders').selectAll();
    let countQuery = this.db.selectFrom('orders').select(this.db.fn.countAll<number>().as('total'));

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
