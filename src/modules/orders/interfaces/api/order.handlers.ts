import { ResponseHelper } from '@/shared/utils/http-response.utils';
import { validateInput } from '@/shared/utils/validate-input.utils';
import { withUser } from '@/shared/utils/with-user.middleware';
import { CreateOrderSchema, TCreateOrderDto } from '@/modules/orders/application/dtos/order.dto';
import {
  createOrderUseCase,
  listOrdersUseCase,
  getOrderUseCase,
  userLookupAdapter,
} from '@/modules/orders/config/dependencies';

const findByCognitoSub = (sub: string) => userLookupAdapter.findByCognitoSub(sub);

export const createOrder = withUser(async (event, context, userId) => {
  const requestId = context.awsRequestId;

  try {
    const idempotencyKey = event.headers['Idempotency-Key'] || event.headers['idempotency-key'];
    if (!idempotencyKey) {
      return ResponseHelper.badRequest('Idempotency-Key header is required', requestId);
    }

    if (!event.body) {
      return ResponseHelper.badRequest('Request body is required', requestId);
    }

    const payload = validateInput<TCreateOrderDto>(CreateOrderSchema, JSON.parse(event.body));
    const result = await createOrderUseCase.execute(userId, payload.items, idempotencyKey);

    if (result.duplicated) {
      return ResponseHelper.success(result, 'Order already exists', requestId);
    }

    return ResponseHelper.created(result, 'Order created successfully', requestId);
  } catch (error) {
    return ResponseHelper.handleError(error as Error, requestId);
  }
}, findByCognitoSub);

export const listOrders = withUser(async (event, context, userId) => {
  const requestId = context.awsRequestId;

  try {
    const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);

    const result = await listOrdersUseCase.execute(userId, limit, offset);
    return ResponseHelper.success(result, 'Orders retrieved successfully', requestId);
  } catch (error) {
    return ResponseHelper.handleError(error as Error, requestId);
  }
}, findByCognitoSub);

export const getOrder = withUser(async (event, context, userId) => {
  const requestId = context.awsRequestId;

  try {
    const orderId = parseInt(event.pathParameters?.id || '0', 10);
    if (!orderId) {
      return ResponseHelper.badRequest('Order ID is required', requestId);
    }

    const order = await getOrderUseCase.execute(orderId, userId);

    if (!order) {
      return ResponseHelper.notFound('Order not found', requestId);
    }

    return ResponseHelper.success(order, 'Order retrieved successfully', requestId);
  } catch (error) {
    return ResponseHelper.handleError(error as Error, requestId);
  }
}, findByCognitoSub);
