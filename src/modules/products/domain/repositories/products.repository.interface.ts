export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: Date;
  updated_at: Date;
}

export interface CreateProductData {
  name: string;
  description?: string | null;
  price: number;
  stock?: number;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface UpdateProductData {
  name?: string;
  description?: string | null;
  price?: number;
  stock?: number;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface ProductsRepository {
  create(data: CreateProductData): Promise<number>;
  findById(id: number): Promise<Product | null>;
  findAll(limit?: number, offset?: number, status?: string): Promise<{ products: Product[]; total: number }>;
  findActive(limit?: number, offset?: number): Promise<{ products: Product[]; total: number }>;
  update(id: number, data: UpdateProductData): Promise<void>;
  deductStock(id: number, quantity: number): Promise<boolean>;
  restoreStock(id: number, quantity: number): Promise<void>;
}
