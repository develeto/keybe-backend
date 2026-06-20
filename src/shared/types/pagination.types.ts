export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export function buildPaginationMeta(total: number, limit: number, offset: number): PaginationMeta {
  return {
    total,
    limit,
    offset,
    has_more: offset + limit < total,
  };
}
