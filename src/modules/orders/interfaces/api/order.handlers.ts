import { ResponseHelper } from '@/shared/utils/http-response.utils';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { validateInput } from '@/shared/utils/validate-input.utils';
import { CreateOrderSchema, TCreateOrderDto } from '@/modules/orders/application/dtos/order.dto';
import { CreateOrderUseCase, ListOrdersUseCase, GetOrderUseCase } from '@/modules/orders/application/uses-cases';
import ordersRepository from '@/modules/orders/config/dependencies';
import { UserLookupAdapter } from '@/shared/infrastructure/db/user-lookup.adapter';

const userLookup = new UserLookupAdapter();

async function resolveUserId(event: APIGatewayProxyEvent): Promise<number> {
  const cognitoSub = event.requestContext?.authorizer?.jwt?.claims?.sub as string | undefined;
  if (!cognitoSub) return 0;
  const userId = await userLookup.findByCognitoSub(cognitoSub);
  return userId ?? 0;
}

const createOrderUseCase = new CreateOrderUseCase(ordersRepository);
const listOrdersUseCase = new ListOrdersUseCase(ordersRepository);
const getOrderUseCase = new GetOrderUseCase(ordersRepository);

export const createOrder = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
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
    const userId = await resolveUserId(event);
    if (!userId) return ResponseHelper.unauthorized('User not found', requestId);

    const result = await createOrderUseCase.execute(userId, payload.items, idempotencyKey);

    if (result.duplicated) {
      return ResponseHelper.success(result, 'Order already exists', requestId);
    }

    return ResponseHelper.created(result, 'Order created successfully', requestId);
  } catch (error) {
    return ResponseHelper.handleError(error as Error, requestId);
  }
};

export const listOrders = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;

  try {
    const userId = await resolveUserId(event);
    if (!userId) return ResponseHelper.unauthorized('User not found', requestId);

    const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);

    const result = await listOrdersUseCase.execute(userId, limit, offset);
    return ResponseHelper.success(result, 'Orders retrieved successfully', requestId);
  } catch (error) {
    return ResponseHelper.handleError(error as Error, requestId);
  }
};

export const getOrder = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;

  try {
    const orderId = parseInt(event.pathParameters?.id || '0', 10);
    if (!orderId) {
      return ResponseHelper.badRequest('Order ID is required', requestId);
    }

    const userId = await resolveUserId(event);
    if (!userId) return ResponseHelper.unauthorized('User not found', requestId);

    const order = await getOrderUseCase.execute(orderId, userId);

    if (!order) {
      return ResponseHelper.notFound('Order not found', requestId);
    }

    return ResponseHelper.success(order, 'Order retrieved successfully', requestId);
  } catch (error) {
    return ResponseHelper.handleError(error as Error, requestId);
  }
};
