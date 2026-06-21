import { z } from 'zod';

export const CreateOrderSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.number({ required_error: 'product_id is required' }),
        quantity: z.number({ required_error: 'quantity is required' }).min(1),
      })
    )
    .min(1, 'Order must have at least one item'),
});

export type TCreateOrderDto = z.infer<typeof CreateOrderSchema>;

export interface OrderResponseDto {
  id: number;
  user_id: number;
  status: string;
  total: number;
  items: Array<{
    product_id: number;
    quantity: number;
    price: number;
  }>;
  created_at: string;
  updated_at: string;
}

export interface OrderListResponseDto {
  orders: OrderResponseDto[];
  total: number;
}
