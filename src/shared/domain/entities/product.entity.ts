export interface ProductEntity {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: Date;
  updated_at: Date;
}
