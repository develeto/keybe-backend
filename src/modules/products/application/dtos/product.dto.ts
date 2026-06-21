import { z } from 'zod';

export const CreateProductSchema = z.object({
  name: z.string({ required_error: 'name is required' }).min(1).max(255),
  description: z.string().max(500).optional().nullable(),
  price: z.number({ required_error: 'price is required' }).min(0),
  stock: z.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional().nullable(),
  price: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export type TCreateProductDto = z.infer<typeof CreateProductSchema>;
export type TUpdateProductDto = z.infer<typeof UpdateProductSchema>;

export interface ProductResponseDto {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ProductListResponseDto {
  products: ProductResponseDto[];
  total: number;
}
