import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
  DomainError,
} from '@/shared/utils/error-handler.utils';

describe('Error Classes', () => {
  it('NotFoundError should have correct name and statusCode', () => {
    const error = new NotFoundError('User not found');
    expect(error.name).toBe('NotFoundError');
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('User not found');
  });

  it('ValidationError should have correct name and statusCode', () => {
    const error = new ValidationError('Invalid input');
    expect(error.name).toBe('ValidationError');
    expect(error.statusCode).toBe(400);
  });

  it('UnauthorizedError should have correct name and statusCode', () => {
    const error = new UnauthorizedError('No token');
    expect(error.name).toBe('UnauthorizedError');
    expect(error.statusCode).toBe(401);
  });

  it('ForbiddenError should have correct name and statusCode', () => {
    const error = new ForbiddenError('Admin only');
    expect(error.name).toBe('ForbiddenError');
    expect(error.statusCode).toBe(403);
  });

  it('BadRequestError should have correct name and statusCode', () => {
    const error = new BadRequestError('Invalid request');
    expect(error.name).toBe('BadRequestError');
    expect(error.statusCode).toBe(400);
  });

  it('ConflictError should have correct name and statusCode', () => {
    const error = new ConflictError('Already exists');
    expect(error.name).toBe('ConflictError');
    expect(error.statusCode).toBe(409);
  });

  it('DomainError should have correct name', () => {
    const error = new DomainError('Business rule violated');
    expect(error.name).toBe('DomainError');
    expect(error.statusCode).toBeUndefined();
  });

  it('should use default messages when not provided', () => {
    expect(new NotFoundError().message).toBe('Resource not found');
    expect(new ValidationError().message).toBe('Invalid data');
    expect(new UnauthorizedError().message).toBe('Unauthorized');
    expect(new ForbiddenError().message).toBe('Forbidden');
    expect(new BadRequestError().message).toBe('Bad request');
    expect(new ConflictError().message).toBe('Resource already exists');
  });
});
