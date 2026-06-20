import { OrderStatus } from '@/shared/domain/value-objects/order-status';

export interface OrderEntity {
  id: number;
  user_id: number;
  status: OrderStatus;
  total: number;
  items: string;
  idempotency_key: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItem {
  product_id: number;
  quantity: number;
  price: number;
}

export interface OrderWithParsedItems extends Omit<OrderEntity, 'items'> {
  items: OrderItem[];
}
