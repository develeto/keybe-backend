import { ResponseHelper } from '@/shared/utils/http-response.utils';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { validateInput } from '@/shared/utils/validate-input.utils';
import { LoginSchema, TLoginDto } from '@/modules/auth/application/dtos/auth.dto';
import { loginUseCase } from '@/modules/auth/config/dependencies';

export const login = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;

  try {
    if (!event.body) {
      return ResponseHelper.badRequest('Request body is required', requestId);
    }

    const payload = validateInput<TLoginDto>(LoginSchema, JSON.parse(event.body));
    const result = await loginUseCase.execute(payload.username, payload.password);

    return ResponseHelper.success(result, 'Login successful', requestId);
  } catch (error) {
    return ResponseHelper.handleError(error as Error, requestId);
  }
};
