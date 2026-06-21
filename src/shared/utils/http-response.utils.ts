import { APIGatewayProxyResult } from 'aws-lambda';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

type ResponseStatus = 'success' | 'error';

interface ResponseBody<T = unknown> {
  status: ResponseStatus;
  message: string;
  data: T | null;
  error: unknown | false;
}

export class ResponseHelper {
  private static buildResponse<T>(
    statusCode: number,
    status: ResponseStatus,
    message: string,
    data: T | null,
    error: unknown | false,
    requestId: string
  ): APIGatewayProxyResult {
    const body: ResponseBody<T> = { status, message, data, error };
    const headers = {
      ...DEFAULT_HEADERS,
      ...(requestId ? { 'X-Request-Id': requestId } : {}),
    };

    return {
      statusCode,
      headers,
      body: JSON.stringify(body),
    };
  }

  static success<T>(data: T, message = 'Success', requestId = '') {
    return this.buildResponse(200, 'success', message, data, false, requestId);
  }

  static created<T>(data: T, message = 'Resource created successfully', requestId = '') {
    return this.buildResponse(201, 'success', message, data, false, requestId);
  }

  static badRequest(error: unknown, message = 'Bad Request', requestId = '') {
    return this.buildResponse(400, 'error', message, null, error, requestId);
  }

  static unauthorized(message = 'Unauthorized', requestId = '') {
    return this.buildResponse(401, 'error', message, null, false, requestId);
  }

  static forbidden(message = 'Forbidden', requestId = '') {
    return this.buildResponse(403, 'error', message, null, false, requestId);
  }

  static notFound(message = 'Resource not found', requestId = '') {
    return this.buildResponse(404, 'error', message, null, false, requestId);
  }

  static internalServerError(error: unknown, message = 'Internal Server Error', requestId = '') {
    return this.buildResponse(500, 'error', message, null, error, requestId);
  }

  static handleError(error: Error, requestId = '') {
    const err = error as Error & { statusCode?: number; name: string };
    const message = err.message || 'Unexpected error';

    switch (err.name) {
      case 'NotFoundError':
        return this.notFound(message, requestId);
      case 'ValidationError':
        return this.badRequest(error, message, requestId);
      case 'UnauthorizedError':
        return this.unauthorized(message, requestId);
      case 'ForbiddenError':
        return this.forbidden(message, requestId);
      default:
        return this.internalServerError(error, message, requestId);
    }
  }
}
