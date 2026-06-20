export type ResponseStatus = 'success' | 'error';

export interface ApiResponse<T = unknown> {
  status: ResponseStatus;
  message: string;
  data: T | null;
  error: unknown | false;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  orders: T[];
  total: number;
}
