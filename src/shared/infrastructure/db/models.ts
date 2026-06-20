import { ColumnType, Generated } from 'kysely';

export interface UserModel {
  id: Generated<number>;
  email: string;
  username: string;
  password_hash: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  cognito_sub: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface OrderModel {
  id: Generated<number>;
  user_id: number;
  status: 'PENDING' | 'VALIDATING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  total: number;
  items: string;
  idempotency_key: string;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface OrderStatusHistoryModel {
  id: Generated<number>;
  order_id: number;
  from_status: string;
  to_status: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface ProductModel {
  id: Generated<number>;
  name: string;
  description: string;
  price: number;
  stock: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface OrderFlowDatabase {
  users: UserModel;
  orders: OrderModel;
  order_status_history: OrderStatusHistoryModel;
  products: ProductModel;
}
