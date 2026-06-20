import { CreateOrderUseCase, ListOrdersUseCase, GetOrderUseCase, ProcessOrderUseCase } from '@/modules/orders/application/uses-cases/order.use-cases';
import { OrdersRepository } from '@/modules/orders/domain/repositories/orders.repository.interface';
import { sendMessage } from '@/shared/infrastructure/aws/sqs';

jest.mock('@/shared/infrastructure/aws/sqs', () => ({
  sendMessage: jest.fn(),
}));

describe('CreateOrderUseCase', () => {
  let useCase: CreateOrderUseCase;
  let mockRepo: jest.Mocked<OrdersRepository>;

  const mockItems = [
    { product_id: 1, quantity: 2, price: 10.00 },
    { product_id: 2, quantity: 1, price: 25.00 },
  ];

  beforeEach(() => {
    process.env.ORDERS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123/test-queue';
    mockRepo = {
      findById: jest.fn(),
      findByUser: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
      findAll: jest.fn(),
    };
    useCase = new CreateOrderUseCase(mockRepo);
    jest.clearAllMocks();
  });

  it('should return existing order when idempotency key matches', async () => {
    const existingOrder = {
      id: 1,
      status: 'PENDING' as const,
      total: 45.00,
      items: JSON.stringify(mockItems),
      created_at: new Date(),
    };
    mockRepo.findByIdempotencyKey.mockResolvedValue(existingOrder);

    const result = await useCase.execute(1, mockItems, 'existing-key');

    expect(result.duplicated).toBe(true);
    expect(result.id).toBe(1);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('should create new order and send SQS message', async () => {
    mockRepo.findByIdempotencyKey.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(1);

    const result = await useCase.execute(1, mockItems, 'new-key-123');

    expect(mockRepo.findByIdempotencyKey).toHaveBeenCalledWith('new-key-123');
    expect(mockRepo.create).toHaveBeenCalledWith({
      user_id: 1,
      status: 'PENDING',
      total: 45.00,
      items: JSON.stringify(mockItems),
      idempotency_key: 'new-key-123',
    });
    expect(sendMessage).toHaveBeenCalledWith(
      process.env.ORDERS_QUEUE_URL,
      { orderId: 1, action: 'PROCESS_ORDER' }
    );
    expect(result.duplicated).toBe(false);
    expect(result.id).toBe(1);
    expect(result.status).toBe('PENDING');
  });
});

describe('ListOrdersUseCase', () => {
  let useCase: ListOrdersUseCase;
  let mockRepo: jest.Mocked<OrdersRepository>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findByUser: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
      findAll: jest.fn(),
    };
    useCase = new ListOrdersUseCase(mockRepo);
  });

  it('should return user orders with pagination', async () => {
    const mockResult = {
      orders: [
        { id: 1, status: 'PENDING' as const, total: 100, items: '[]', created_at: new Date(), updated_at: new Date() },
      ],
      total: 1,
    };
    mockRepo.findByUser.mockResolvedValue(mockResult);

    const result = await useCase.execute(1, 10, 0);

    expect(mockRepo.findByUser).toHaveBeenCalledWith(1, 10, 0);
    expect(result).toEqual(mockResult);
  });
});

describe('GetOrderUseCase', () => {
  let useCase: GetOrderUseCase;
  let mockRepo: jest.Mocked<OrdersRepository>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findByUser: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
      findAll: jest.fn(),
    };
    useCase = new GetOrderUseCase(mockRepo);
  });

  it('should return order when found and belongs to user', async () => {
    const order = { id: 1, user_id: 1, status: 'PENDING' as const, total: 100, items: '[]', idempotency_key: 'key', created_at: new Date(), updated_at: new Date() };
    mockRepo.findById.mockResolvedValue(order);

    const result = await useCase.execute(1, 1);

    expect(result).toEqual(order);
  });

  it('should return null when order belongs to different user', async () => {
    mockRepo.findById.mockResolvedValue({ id: 1, user_id: 2 } as any);

    const result = await useCase.execute(1, 1);

    expect(result).toBeNull();
  });

  it('should return null when order not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await useCase.execute(999, 1);

    expect(result).toBeNull();
  });
});

describe('ProcessOrderUseCase', () => {
  let useCase: ProcessOrderUseCase;
  let mockRepo: jest.Mocked<OrdersRepository>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findByUser: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
      findAll: jest.fn(),
    };
    useCase = new ProcessOrderUseCase(mockRepo);
  });

  it('should process order from PENDING to COMPLETED', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1,
      status: 'PENDING',
      items: JSON.stringify([{ product_id: 1, quantity: 2, price: 10 }]),
    } as any);

    const result = await useCase.execute(1);

    expect(mockRepo.updateStatus).toHaveBeenNthCalledWith(1, 1, 'PROCESSING');
    expect(mockRepo.updateStatus).toHaveBeenNthCalledWith(2, 1, 'COMPLETED');
    expect(result).toEqual({ id: 1, status: 'COMPLETED', total: 20 });
  });

  it('should throw error when order not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(999)).rejects.toThrow('Order not found');
  });

  it('should throw error when status transition is invalid', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 1,
      status: 'COMPLETED',
    } as any);

    await expect(useCase.execute(1)).rejects.toThrow('Cannot process order in status COMPLETED');
  });
});
