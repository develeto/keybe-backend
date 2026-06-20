import { OrderAdminPort } from '@/shared/domain/ports/order-admin.port';
import { Kysely, sql } from 'kysely';
import type { OrderFlowDatabase } from '@/shared/infrastructure/db/models';

export class OrderAdminAdapter implements OrderAdminPort {
  constructor(private readonly db: Kysely<OrderFlowDatabase>) {}

  async findAll(limit = 20, offset = 0, statusFilter?: string) {
    let query = this.db.selectFrom('orders').selectAll();
    let countQuery = this.db.selectFrom('orders').select(this.db.fn.countAll<number>().as('total'));

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
    const result = await this.db
      .selectFrom('orders')
      .select(['id', 'status', 'items'])
      .where('id', '=', id)
      .executeTakeFirst();

    if (!result) return null;
    return { id: result.id, status: result.status as string, items: result.items };
  }

  async updateStatus(id: number, status: string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom('orders')
        .select('status')
        .where('id', '=', id)
        .executeTakeFirst();

      await trx
        .updateTable('orders')
        .set({ status: status as any, updated_at: sql`NOW()` })
        .where('id', '=', id)
        .execute();

      await trx
        .insertInto('order_status_history')
        .values({
          order_id: id,
          from_status: current?.status as string ?? 'UNKNOWN',
          to_status: status,
          created_at: sql`NOW()`,
        })
        .execute();
    });
  }
}
