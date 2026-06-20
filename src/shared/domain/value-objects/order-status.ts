export type OrderStatus =
  | 'PENDING'
  | 'VALIDATING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export const VALID_ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'VALIDATING',
  'PROCESSING',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
];

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['VALIDATING', 'PROCESSING', 'CANCELLED'],
  VALIDATING: ['PROCESSING', 'FAILED', 'CANCELLED'],
  PROCESSING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
