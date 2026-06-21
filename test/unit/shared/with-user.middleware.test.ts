import { withUser } from '@/shared/utils/with-user.middleware';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

describe('withUser middleware', () => {
  let mockHandler: jest.Mock;
  let mockFindByCognitoSub: jest.Mock;
  let wrapped: ReturnType<typeof withUser>;

  beforeEach(() => {
    mockHandler = jest.fn().mockResolvedValue({ statusCode: 200, body: '{}', headers: {} });
    mockFindByCognitoSub = jest.fn();
    wrapped = withUser(mockHandler, mockFindByCognitoSub);
  });

  it('should call handler with userId when authenticated', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: { claims: { sub: 'cognito-sub-123' } },
        },
      },
    } as unknown as APIGatewayProxyEvent;
    const context = { awsRequestId: 'req-123' } as Context;

    mockFindByCognitoSub.mockResolvedValue(42);

    await wrapped(event, context);

    expect(mockFindByCognitoSub).toHaveBeenCalledWith('cognito-sub-123');
    expect(mockHandler).toHaveBeenCalledWith(event, context, 42);
  });

  it('should return 401 when no cognito sub', async () => {
    const event = {
      requestContext: {},
    } as unknown as APIGatewayProxyEvent;
    const context = { awsRequestId: 'req-123' } as Context;

    const result = await wrapped(event, context);

    expect(result.statusCode).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should return 401 when user not found', async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: { claims: { sub: 'unknown-sub' } },
        },
      },
    } as unknown as APIGatewayProxyEvent;
    const context = { awsRequestId: 'req-123' } as Context;

    mockFindByCognitoSub.mockResolvedValue(null);

    const result = await wrapped(event, context);

    expect(result.statusCode).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });
});
