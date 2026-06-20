import { OrderAdminPort } from '@/shared/domain/ports/order-admin.port';
import { OrderAdminAdapter } from '@/shared/infrastructure/db/order-admin.adapter';
import { Kysely } from 'kysely';
import type { OrderFlowDatabase } from '@/shared/infrastructure/db/models';

export class AdminDbRepository implements OrderAdminPort {
  private readonly adapter: OrderAdminAdapter;

  constructor(db: Kysely<OrderFlowDatabase>) {
    this.adapter = new OrderAdminAdapter(db);
  }

  async findAll(limit = 20, offset = 0, statusFilter?: string) {
    return this.adapter.findAll(limit, offset, statusFilter);
  }

  async findById(id: number) {
    return this.adapter.findById(id);
  }

  async updateStatus(id: number, status: string) {
    return this.adapter.updateStatus(id, status);
  }
}
