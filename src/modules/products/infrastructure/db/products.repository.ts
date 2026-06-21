import { Kysely, sql } from 'kysely';
import type { OrderFlowDatabase } from '@/shared/infrastructure/db/models';
import {
  ProductsRepository,
  CreateProductData,
  UpdateProductData,
  Product,
} from '@/modules/products/domain/repositories/products.repository.interface';

export class ProductsDbRepository implements ProductsRepository {
  constructor(private readonly db: Kysely<OrderFlowDatabase>) {}

  async create(data: CreateProductData): Promise<number> {
    const result = await this.db
      .insertInto('products')
      .values({
        name: data.name,
        description: data.description ?? null,
        price: data.price,
        stock: data.stock ?? 0,
        status: data.status ?? 'ACTIVE',
        created_at: sql`NOW()`,
        updated_at: sql`NOW()`,
      })
      .executeTakeFirst();
    return Number(result.insertId);
  }

  async findById(id: number): Promise<Product | null> {
    const result = await this.db
      .selectFrom('products')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return result ?? null;
  }

  async findAll(limit = 20, offset = 0, status?: string): Promise<{ products: Product[]; total: number }> {
    let query = this.db.selectFrom('products').selectAll();
    let countQuery = this.db.selectFrom('products').select(this.db.fn.countAll<number>().as('total'));

    if (status) {
      query = query.where('status', '=', status as any);
      countQuery = countQuery.where('status', '=', status as any);
    }

    const countResult = await countQuery.executeTakeFirst();
    const products = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    return { products, total: Number(countResult?.total ?? 0) };
  }

  async findActive(limit = 20, offset = 0): Promise<{ products: Product[]; total: number }> {
    return this.findAll(limit, offset, 'ACTIVE');
  }

  async update(id: number, data: UpdateProductData): Promise<void> {
    await this.db
      .updateTable('products')
      .set({
        ...data,
        updated_at: sql`NOW()`,
      })
      .where('id', '=', id)
      .execute();
  }
}
