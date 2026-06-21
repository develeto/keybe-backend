import {
  canTransition,
  VALID_ORDER_STATUSES,
} from '@/modules/orders/domain/value-objects/order-status';

describe('OrderStatus', () => {
  it('should allow PENDING → VALIDATING', () => {
    expect(canTransition('PENDING', 'VALIDATING')).toBe(true);
  });

  it('should allow PENDING → CANCELLED', () => {
    expect(canTransition('PENDING', 'CANCELLED')).toBe(true);
  });

  it('should not allow PENDING → COMPLETED', () => {
    expect(canTransition('PENDING', 'COMPLETED')).toBe(false);
  });

  it('should not allow COMPLETED → any status', () => {
    expect(canTransition('COMPLETED', 'PENDING')).toBe(false);
    expect(canTransition('COMPLETED', 'PROCESSING')).toBe(false);
  });

  it('should allow VALIDATING → PROCESSING', () => {
    expect(canTransition('VALIDATING', 'PROCESSING')).toBe(true);
  });

  it('should allow VALIDATING → FAILED', () => {
    expect(canTransition('VALIDATING', 'FAILED')).toBe(true);
  });

  it('should allow PROCESSING → COMPLETED', () => {
    expect(canTransition('PROCESSING', 'COMPLETED')).toBe(true);
  });

  it('should allow PROCESSING → FAILED', () => {
    expect(canTransition('PROCESSING', 'FAILED')).toBe(true);
  });

  it('should have all valid statuses', () => {
    expect(VALID_ORDER_STATUSES).toEqual([
      'PENDING',
      'VALIDATING',
      'PROCESSING',
      'COMPLETED',
      'CANCELLED',
      'FAILED',
    ]);
  });

  it('should return false for unknown status', () => {
    expect(canTransition('UNKNOWN' as any, 'PENDING')).toBe(false);
    expect(canTransition('PENDING', 'UNKNOWN' as any)).toBe(false);
  });
});
