import { OrderStatus } from '../value-objects/order-status';

export interface OrdersRepository {
  findById(id: number): Promise<{
    id: number;
    user_id: number;
    status: OrderStatus;
    total: number;
    items: string;
    idempotency_key: string;
    created_at: Date;
    updated_at: Date;
  } | null>;
  findByUser(
    userId: number,
    limit?: number,
    offset?: number
  ): Promise<{
    orders: Array<{
      id: number;
      status: OrderStatus;
      total: number;
      items: string;
      created_at: Date;
      updated_at: Date;
    }>;
    total: number;
  }>;
  findByIdempotencyKey(key: string): Promise<{
    id: number;
    status: OrderStatus;
    total: number;
    items: string;
    created_at: Date;
  } | null>;
  create(data: {
    user_id: number;
    status: OrderStatus;
    total: number;
    items: string;
    idempotency_key: string;
  }): Promise<number>;
  updateStatus(id: number, status: OrderStatus): Promise<void>;
  findAll(
    limit?: number,
    offset?: number,
    statusFilter?: OrderStatus
  ): Promise<{
    orders: Array<{
      id: number;
      user_id: number;
      status: OrderStatus;
      total: number;
      items: string;
      created_at: Date;
      updated_at: Date;
    }>;
    total: number;
  }>;
}
