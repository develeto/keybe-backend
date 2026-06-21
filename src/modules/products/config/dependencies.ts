import { ProductsDbRepository } from '@/modules/products/infrastructure/db/products.repository';
import {
  CreateProductUseCase,
  GetProductUseCase,
  ListProductsUseCase,
  ListActiveProductsUseCase,
  UpdateProductUseCase,
} from '@/modules/products/application/uses-cases/product.use-cases';
import { getDatabaseInstance } from '@/shared/infrastructure/db/kysely-client';
import { userLookupAdapter } from '@/modules/orders/config/dependencies';

const db = getDatabaseInstance();
const productsRepository = new ProductsDbRepository(db);

export const createProductUseCase = new CreateProductUseCase(productsRepository);
export const getProductUseCase = new GetProductUseCase(productsRepository);
export const listProductsUseCase = new ListProductsUseCase(productsRepository);
export const listActiveProductsUseCase = new ListActiveProductsUseCase(productsRepository);
export const updateProductUseCase = new UpdateProductUseCase(productsRepository);

export { userLookupAdapter };
