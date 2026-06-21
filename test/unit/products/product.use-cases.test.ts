import { CreateProductUseCase, GetProductUseCase, ListProductsUseCase, ListActiveProductsUseCase, UpdateProductUseCase } from '@/modules/products/application/uses-cases/product.use-cases';
import { ProductsRepository } from '@/modules/products/domain/repositories/products.repository.interface';

describe('CreateProductUseCase', () => {
  let useCase: CreateProductUseCase;
  let mockRepo: jest.Mocked<ProductsRepository>;

  const mockProduct = {
    id: 1, name: 'Test', description: null, price: 100, stock: 10, status: 'ACTIVE' as const, created_at: new Date(), updated_at: new Date(),
  };

  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
      update: jest.fn(),
      deductStock: jest.fn(),
      restoreStock: jest.fn(),
    };
    useCase = new CreateProductUseCase(mockRepo);
  });

  it('should create and return product', async () => {
    mockRepo.create.mockResolvedValue(1);
    mockRepo.findById.mockResolvedValue(mockProduct);

    const result = await useCase.execute({ name: 'Test', price: 100 });

    expect(mockRepo.create).toHaveBeenCalledWith({ name: 'Test', price: 100 });
    expect(result).toEqual(mockProduct);
  });

  it('should throw when product not found after creation', async () => {
    mockRepo.create.mockResolvedValue(1);
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute({ name: 'Test', price: 100 })).rejects.toThrow('Product not found after creation');
  });
});

describe('GetProductUseCase', () => {
  let useCase: GetProductUseCase;
  let mockRepo: jest.Mocked<ProductsRepository>;

  const mockProduct = {
    id: 1, name: 'Test', description: null, price: 100, stock: 10, status: 'ACTIVE' as const, created_at: new Date(), updated_at: new Date(),
  };

  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
      update: jest.fn(),
      deductStock: jest.fn(),
      restoreStock: jest.fn(),
    };
    useCase = new GetProductUseCase(mockRepo);
  });

  it('should return product when found', async () => {
    mockRepo.findById.mockResolvedValue(mockProduct);

    const result = await useCase.execute(1);

    expect(result).toEqual(mockProduct);
  });

  it('should throw when product not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(999)).rejects.toThrow('Product not found');
  });
});

describe('ListProductsUseCase', () => {
  let useCase: ListProductsUseCase;
  let mockRepo: jest.Mocked<ProductsRepository>;

  const mockResult = { products: [], total: 0 };

  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
      update: jest.fn(),
      deductStock: jest.fn(),
      restoreStock: jest.fn(),
    };
    useCase = new ListProductsUseCase(mockRepo);
  });

  it('should return paginated products', async () => {
    mockRepo.findAll.mockResolvedValue(mockResult);

    const result = await useCase.execute(10, 0, 'ACTIVE');

    expect(mockRepo.findAll).toHaveBeenCalledWith(10, 0, 'ACTIVE');
    expect(result).toEqual(mockResult);
  });

  it('should use default params when not provided', async () => {
    mockRepo.findAll.mockResolvedValue(mockResult);

    const result = await useCase.execute();

    expect(mockRepo.findAll).toHaveBeenCalledWith(20, 0, undefined);
    expect(result).toEqual(mockResult);
  });
});

describe('ListActiveProductsUseCase', () => {
  let useCase: ListActiveProductsUseCase;
  let mockRepo: jest.Mocked<ProductsRepository>;

  const mockResult = { products: [], total: 0 };

  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
      update: jest.fn(),
      deductStock: jest.fn(),
      restoreStock: jest.fn(),
    };
    useCase = new ListActiveProductsUseCase(mockRepo);
  });

  it('should return active products', async () => {
    mockRepo.findActive.mockResolvedValue(mockResult);

    const result = await useCase.execute(10, 0);

    expect(mockRepo.findActive).toHaveBeenCalledWith(10, 0);
    expect(result).toEqual(mockResult);
  });

  it('should use default params when not provided', async () => {
    mockRepo.findActive.mockResolvedValue(mockResult);

    const result = await useCase.execute();

    expect(mockRepo.findActive).toHaveBeenCalledWith(20, 0);
    expect(result).toEqual(mockResult);
  });
});

describe('UpdateProductUseCase', () => {
  let useCase: UpdateProductUseCase;
  let mockRepo: jest.Mocked<ProductsRepository>;

  const mockProduct = {
    id: 1, name: 'Test', description: null, price: 100, stock: 10, status: 'ACTIVE' as const, created_at: new Date(), updated_at: new Date(),
  };

  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
      update: jest.fn(),
      deductStock: jest.fn(),
      restoreStock: jest.fn(),
    };
    useCase = new UpdateProductUseCase(mockRepo);
  });

  it('should update and return product', async () => {
    mockRepo.findById.mockResolvedValueOnce(mockProduct).mockResolvedValueOnce({ ...mockProduct, name: 'Updated' });
    mockRepo.update.mockResolvedValue(undefined);

    const result = await useCase.execute(1, { name: 'Updated' });

    expect(mockRepo.findById).toHaveBeenCalledTimes(2);
    expect(mockRepo.update).toHaveBeenCalledWith(1, { name: 'Updated' });
    expect(result).toEqual({ ...mockProduct, name: 'Updated' });
  });

  it('should throw when product not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(999, { name: 'Updated' })).rejects.toThrow('Product not found');
  });
});
