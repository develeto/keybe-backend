import { CreateOrderSchema } from '@/modules/orders/application/dtos/order.dto';
import { LoginSchema, RegisterSchema } from '@/modules/auth/application/dtos/auth.dto';
import { UpdateOrderStatusSchema } from '@/modules/admin/application/dtos/admin.dto';
import { CreateProductSchema, UpdateProductSchema } from '@/modules/products/application/dtos/product.dto';

describe('Order DTO - CreateOrderSchema', () => {
  it('should accept valid payload', () => {
    const result = CreateOrderSchema.parse({
      items: [{ product_id: 1, quantity: 2 }],
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].product_id).toBe(1);
    expect(result.items[0].quantity).toBe(2);
  });

  it('should reject empty items', () => {
    expect(() => CreateOrderSchema.parse({ items: [] })).toThrow();
  });

  it('should reject missing product_id', () => {
    expect(() => CreateOrderSchema.parse({ items: [{ quantity: 2 }] })).toThrow();
  });

  it('should reject missing items', () => {
    expect(() => CreateOrderSchema.parse({})).toThrow();
  });
});

describe('Auth DTO - LoginSchema', () => {
  it('should accept valid login', () => {
    const result = LoginSchema.parse({ username: 'admin', password: 'pass' });
    expect(result.username).toBe('admin');
  });

  it('should reject empty password', () => {
    expect(() => LoginSchema.parse({ username: 'admin', password: '' })).toThrow();
  });

  it('should reject missing username', () => {
    expect(() => LoginSchema.parse({ password: 'pass' })).toThrow();
  });
});

describe('Auth DTO - RegisterSchema', () => {
  it('should accept valid registration', () => {
    const result = RegisterSchema.parse({
      email: 'test@example.com',
      username: 'testuser',
      password: 'Test1234!',
    });
    expect(result.email).toBe('test@example.com');
  });

  it('should reject invalid email', () => {
    expect(() => RegisterSchema.parse({
      email: 'not-email',
      username: 'testuser',
      password: 'Test1234!',
    })).toThrow();
  });

  it('should reject short password', () => {
    expect(() => RegisterSchema.parse({
      email: 'test@example.com',
      username: 'testuser',
      password: 'Short1!',
    })).toThrow();
  });

  it('should reject password without uppercase', () => {
    expect(() => RegisterSchema.parse({
      email: 'test@example.com',
      username: 'testuser',
      password: 'test1234!',
    })).toThrow();
  });
});

describe('Admin DTO - UpdateOrderStatusSchema', () => {
  it('should accept valid status', () => {
    const result = UpdateOrderStatusSchema.parse({ status: 'PROCESSING' });
    expect(result.status).toBe('PROCESSING');
  });

  it('should reject invalid status', () => {
    expect(() => UpdateOrderStatusSchema.parse({ status: 'INVALID' })).toThrow();
  });
});

describe('Product DTO - CreateProductSchema', () => {
  it('should accept valid product', () => {
    const result = CreateProductSchema.parse({
      name: 'Laptop', price: 999.99, stock: 10, status: 'ACTIVE',
    });
    expect(result.name).toBe('Laptop');
    expect(result.price).toBe(999.99);
  });

  it('should accept minimal product', () => {
    const result = CreateProductSchema.parse({ name: 'Mouse', price: 29.99 });
    expect(result.name).toBe('Mouse');
  });

  it('should reject empty name', () => {
    expect(() => CreateProductSchema.parse({ name: '', price: 10 })).toThrow();
  });

  it('should reject negative price', () => {
    expect(() => CreateProductSchema.parse({ name: 'Test', price: -1 })).toThrow();
  });
});

describe('Product DTO - UpdateProductSchema', () => {
  it('should accept partial update', () => {
    const result = UpdateProductSchema.parse({ price: 49.99 });
    expect(result.price).toBe(49.99);
  });

  it('should accept empty object', () => {
    const result = UpdateProductSchema.parse({});
    expect(result).toEqual({});
  });
});
