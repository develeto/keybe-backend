import { ResponseHelper } from '@/shared/utils/http-response.utils';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { validateInput } from '@/shared/utils/validate-input.utils';
import { withUser } from '@/shared/utils/with-user.middleware';
import {
  CreateProductSchema,
  UpdateProductSchema,
  TCreateProductDto,
  TUpdateProductDto,
} from '@/modules/products/application/dtos/product.dto';
import {
  createProductUseCase,
  getProductUseCase,
  listProductsUseCase,
  listActiveProductsUseCase,
  updateProductUseCase,
  userLookupAdapter,
} from '@/modules/products/config/dependencies';

const findByCognitoSub = (sub: string) => userLookupAdapter.findByCognitoSub(sub);

export const createProduct = withUser(async (event, _context, _userId) => {
  const requestId = _context.awsRequestId;

  try {
    if (!event.body) {
      return ResponseHelper.badRequest('Request body is required', requestId);
    }

    const payload = validateInput<TCreateProductDto>(CreateProductSchema, JSON.parse(event.body));
    const result = await createProductUseCase.execute(payload);

    return ResponseHelper.created(result, 'Product created successfully', requestId);
  } catch (error) {
    return ResponseHelper.handleError(error as Error, requestId);
  }
}, findByCognitoSub);

export const adminListProducts = withUser(async (event, _context, _userId) => {
  const requestId = _context.awsRequestId;

  try {
    const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
    const status = event.queryStringParameters?.status;

    const result = await listProductsUseCase.execute(limit, offset, status);
    return ResponseHelper.success(result, 'Products retrieved successfully', requestId);
  } catch (error) {
    return ResponseHelper.handleError(error as Error, requestId);
  }
}, findByCognitoSub);

export const adminGetProduct = withUser(async (event, _context, _userId) => {
  const requestId = _context.awsRequestId;

  try {
    const id = parseInt(event.pathParameters?.id || '0', 10);
    if (!id) {
      return ResponseHelper.badRequest('Product ID is required', requestId);
    }

    const result = await getProductUseCase.execute(id);
    return ResponseHelper.success(result, 'Product retrieved successfully', requestId);
  } catch (error) {
    return ResponseHelper.handleError(error as Error, requestId);
  }
}, findByCognitoSub);

export const adminUpdateProduct = withUser(async (event, _context, _userId) => {
  const requestId = _context.awsRequestId;

  try {
    const id = parseInt(event.pathParameters?.id || '0', 10);
    if (!id) {
      return ResponseHelper.badRequest('Product ID is required', requestId);
    }

    if (!event.body) {
      return ResponseHelper.badRequest('Request body is required', requestId);
    }

    const payload = validateInput<TUpdateProductDto>(UpdateProductSchema, JSON.parse(event.body));
    const result = await updateProductUseCase.execute(id, payload);

    return ResponseHelper.success(result, 'Product updated successfully', requestId);
  } catch (error) {
    return ResponseHelper.handleError(error as Error, requestId);
  }
}, findByCognitoSub);

export const listProducts = withUser(async (event, _context, _userId) => {
  const requestId = _context.awsRequestId;

  try {
    const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);

    const result = await listActiveProductsUseCase.execute(limit, offset);
    return ResponseHelper.success(result, 'Products retrieved successfully', requestId);
  } catch (error) {
    return ResponseHelper.handleError(error as Error, requestId);
  }
}, findByCognitoSub);
