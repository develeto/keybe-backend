import { ProductsRepository } from '@/modules/products/domain/repositories/products.repository.interface';
import { NotFoundError, ConflictError } from '@/shared/utils/error-handler.utils';
import type { CreateProductData, UpdateProductData } from '@/modules/products/domain/repositories/products.repository.interface';

export class CreateProductUseCase {
  constructor(private readonly productRepository: ProductsRepository) {}

  async execute(data: CreateProductData) {
    const id = await this.productRepository.create(data);
    const product = await this.productRepository.findById(id);
    if (!product) throw new NotFoundError('Product not found after creation');
    return product;
  }
}

export class GetProductUseCase {
  constructor(private readonly productRepository: ProductsRepository) {}

  async execute(id: number) {
    const product = await this.productRepository.findById(id);
    if (!product) throw new NotFoundError('Product not found');
    return product;
  }
}

export class ListProductsUseCase {
  constructor(private readonly productRepository: ProductsRepository) {}

  async execute(limit = 20, offset = 0, status?: string) {
    return this.productRepository.findAll(limit, offset, status);
  }
}

export class ListActiveProductsUseCase {
  constructor(private readonly productRepository: ProductsRepository) {}

  async execute(limit = 20, offset = 0) {
    return this.productRepository.findActive(limit, offset);
  }
}

export class UpdateProductUseCase {
  constructor(private readonly productRepository: ProductsRepository) {}

  async execute(id: number, data: UpdateProductData) {
    const existing = await this.productRepository.findById(id);
    if (!existing) throw new NotFoundError('Product not found');
    await this.productRepository.update(id, data);
    const updated = await this.productRepository.findById(id);
    return updated;
  }
}
