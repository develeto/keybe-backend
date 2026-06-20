import { ResponseHelper } from '@/shared/utils/http-response.utils';

describe('ResponseHelper', () => {
  it('should return success response', () => {
    const result = ResponseHelper.success({ id: 1 }, 'Success', 'req-123');
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      status: 'success',
      message: 'Success',
      data: { id: 1 },
      error: false,
    });
    expect(result.headers).toHaveProperty('X-Request-Id', 'req-123');
  });

  it('should return created response', () => {
    const result = ResponseHelper.created({ id: 1 }, 'Created');
    expect(result.statusCode).toBe(201);
  });

  it('should return bad request response', () => {
    const result = ResponseHelper.badRequest('Validation error', 'Bad input');
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('error');
    expect(body.error).toBe('Validation error');
  });

  it('should return unauthorized response', () => {
    const result = ResponseHelper.unauthorized('Not authorized');
    expect(result.statusCode).toBe(401);
  });

  it('should return forbidden response', () => {
    const result = ResponseHelper.forbidden('Access denied');
    expect(result.statusCode).toBe(403);
  });

  it('should return not found response', () => {
    const result = ResponseHelper.notFound('Missing');
    expect(result.statusCode).toBe(404);
  });

  it('should return internal server error response', () => {
    const result = ResponseHelper.internalServerError('DB error', 'Something went wrong');
    expect(result.statusCode).toBe(500);
  });

  it('should handle NotFoundError via handleError', () => {
    const error = new Error('User not found');
    error.name = 'NotFoundError';
    const result = ResponseHelper.handleError(error);
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).message).toBe('User not found');
  });

  it('should handle ValidationError via handleError', () => {
    const error = new Error('Invalid data');
    error.name = 'ValidationError';
    const result = ResponseHelper.handleError(error);
    expect(result.statusCode).toBe(400);
  });

  it('should handle UnauthorizedError via handleError', () => {
    const error = new Error('Not allowed');
    error.name = 'UnauthorizedError';
    const result = ResponseHelper.handleError(error);
    expect(result.statusCode).toBe(401);
  });

  it('should handle unknown error as 500 via handleError', () => {
    const error = new Error('Unexpected');
    const result = ResponseHelper.handleError(error);
    expect(result.statusCode).toBe(500);
  });
});
