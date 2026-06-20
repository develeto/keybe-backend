import { ResponseHelper } from '@/shared/utils/http-response.utils';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { validateInput } from '@/shared/utils/validate-input.utils';
import { UpdateOrderStatusSchema } from '@/modules/admin/application/dtos/admin.dto';
import { AdminListOrdersUseCase, AdminUpdateOrderStatusUseCase } from '@/modules/admin/application/uses-cases/admin.use-cases';
import adminOrdersRepository from '@/modules/admin/config/dependencies';
import { OrderStatus } from '@/shared/domain/value-objects/order-status';

const listOrdersUseCase = new AdminListOrdersUseCase(adminOrdersRepository);
const updateStatusUseCase = new AdminUpdateOrderStatusUseCase(adminOrdersRepository);

export const adminListOrders = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;

  try {
    const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
    const statusFilter = event.queryStringParameters?.status as OrderStatus | undefined;

    const result = await listOrdersUseCase.execute(limit, offset, statusFilter);
    return ResponseHelper.success(result, 'Orders retrieved successfully', requestId);
  } catch (error) {
    return ResponseHelper.handleError(error as Error, requestId);
  }
};

export const adminUpdateOrderStatus = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;

  try {
    const orderId = parseInt(event.pathParameters?.id || '0', 10);
    if (!orderId) {
      return ResponseHelper.badRequest('Order ID is required', requestId);
    }

    if (!event.body) {
      return ResponseHelper.badRequest('Request body is required', requestId);
    }

    const payload = validateInput(UpdateOrderStatusSchema, JSON.parse(event.body));
    const result = await updateStatusUseCase.execute(orderId, payload.status);

    return ResponseHelper.success(result, 'Order status updated successfully', requestId);
  } catch (error) {
    return ResponseHelper.handleError(error as Error, requestId);
  }
};
