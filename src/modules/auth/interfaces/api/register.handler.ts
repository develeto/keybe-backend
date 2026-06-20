import { ResponseHelper } from '@/shared/utils/http-response.utils';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { validateInput } from '@/shared/utils/validate-input.utils';
import { RegisterSchema, TRegisterDto } from '@/modules/auth/application/dtos/auth.dto';
import { registerUseCase } from '@/modules/auth/config/dependencies';

export const register = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;

  try {
    if (!event.body) {
      return ResponseHelper.badRequest('Request body is required', requestId);
    }

    const payload = validateInput<TRegisterDto>(RegisterSchema, JSON.parse(event.body));
    const result = await registerUseCase.execute(payload.email, payload.username, payload.password);

    return ResponseHelper.created(result, 'User registered successfully', requestId);
  } catch (error) {
    return ResponseHelper.handleError(error as Error, requestId);
  }
};
