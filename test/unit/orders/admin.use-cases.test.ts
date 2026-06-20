import { AdminListOrdersUseCase, AdminUpdateOrderStatusUseCase } from '@/modules/admin/application/uses-cases/admin.use-cases';
import { AdminOrdersRepository } from '@/modules/admin/domain/repositories/admin.repository.interface';
import { ValidationError } from '@/shared/utils/error-handler.utils';
import { OrderNotificationPort } from '@/shared/domain/ports/order-notification.port';

describe('AdminListOrdersUseCase', () => {
  let useCase: AdminListOrdersUseCase;
  let mockRepo: jest.Mocked<AdminOrdersRepository>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      updateStatus: jest.fn(),
    };
    useCase = new AdminListOrdersUseCase(mockRepo);
  });

  it('should return all orders with pagination', async () => {
    const mockResult = {
      orders: [{ id: 1, user_id: 1, status: 'PENDING', total: 100, items: '[]', created_at: new Date(), updated_at: new Date() }],
      total: 1,
    };
    mockRepo.findAll.mockResolvedValue(mockResult as any);

    const result = await useCase.execute(10, 0);

    expect(mockRepo.findAll).toHaveBeenCalledWith(10, 0, undefined);
    expect(result).toEqual(mockResult);
  });

  it('should filter by status when provided', async () => {
    await useCase.execute(20, 0, 'COMPLETED');
    expect(mockRepo.findAll).toHaveBeenCalledWith(20, 0, 'COMPLETED');
  });
});

describe('AdminUpdateOrderStatusUseCase', () => {
  let useCase: AdminUpdateOrderStatusUseCase;
  let mockRepo: jest.Mocked<AdminOrdersRepository>;
  let mockNotification: jest.Mocked<OrderNotificationPort>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      updateStatus: jest.fn(),
    };
    mockNotification = {
      notifyStatusChanged: jest.fn(),
    };
    useCase = new AdminUpdateOrderStatusUseCase(mockRepo, mockNotification);
  });

  it('should update order status successfully', async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, status: 'PENDING', items: '[]' } as any);
    mockRepo.updateStatus.mockResolvedValue(undefined);

    const result = await useCase.execute(1, 'PROCESSING');

    expect(mockRepo.updateStatus).toHaveBeenCalledWith(1, 'PROCESSING');
    expect(mockNotification.notifyStatusChanged).toHaveBeenCalledWith({
      orderId: 1,
      fromStatus: 'PENDING',
      toStatus: 'PROCESSING',
      timestamp: expect.any(String),
    });
    expect(result).toEqual({ id: 1, status: 'PROCESSING' });
  });

  it('should throw when order not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(999, 'COMPLETED')).rejects.toThrow(ValidationError);
  });

  it('should throw when status transition is invalid', async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, status: 'COMPLETED', items: '[]' } as any);
    await expect(useCase.execute(1, 'PENDING')).rejects.toThrow('Cannot transition from COMPLETED to PENDING');
  });
});
