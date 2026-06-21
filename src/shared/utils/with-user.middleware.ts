import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ResponseHelper } from '@/shared/utils/http-response.utils';

export type AuthenticatedHandler = (
  event: APIGatewayProxyEvent,
  context: Context,
  userId: number
) => Promise<APIGatewayProxyResult>;

export function withUser(
  handler: AuthenticatedHandler,
  findByCognitoSub: (cognitoSub: string) => Promise<number | null>
) {
  return async (
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> => {
    const requestId = context.awsRequestId;
    const cognitoSub = event.requestContext?.authorizer?.jwt?.claims?.sub as string | undefined;

    if (!cognitoSub) {
      return ResponseHelper.unauthorized('User not authenticated', requestId);
    }

    const userId = await findByCognitoSub(cognitoSub);

    if (!userId) {
      return ResponseHelper.unauthorized('User not found', requestId);
    }

    return handler(event, context, userId);
  };
}
