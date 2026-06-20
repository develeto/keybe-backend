import { OrdersRepository } from '@/modules/orders/domain/repositories/orders.repository.interface';
import { OrderStatus, canTransition } from '@/modules/orders/domain/value-objects/order-status';
import { sendMessage } from '@/shared/infrastructure/aws/sqs';
import { ConflictError, ValidationError } from '@/shared/utils/error-handler.utils';
import { OrderNotificationPort } from '@/shared/domain/ports/order-notification.port';

export class CreateOrderUseCase {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  async execute(
    userId: number,
    items: Array<{ product_id: number; quantity: number; price: number }>,
    idempotencyKey: string
  ) {
    const existing = await this.ordersRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return {
        id: existing.id,
        status: existing.status,
        total: existing.total,
        items: JSON.parse(existing.items),
        created_at: existing.created_at,
        duplicated: true,
      };
    }

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderId = await this.ordersRepository.create({
      user_id: userId,
      status: 'PENDING',
      total,
      items: JSON.stringify(items),
      idempotency_key: idempotencyKey,
    });

    await sendMessage(process.env.ORDERS_QUEUE_URL!, {
      orderId,
      action: 'PROCESS_ORDER',
    });

    return {
      id: orderId,
      status: 'PENDING' as const,
      total,
      items,
      duplicated: false,
    };
  }
}

export class ListOrdersUseCase {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  async execute(userId: number, limit = 20, offset = 0) {
    return this.ordersRepository.findByUser(userId, limit, offset);
  }
}

export class GetOrderUseCase {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  async execute(orderId: number, userId: number) {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) return null;
    if (order.user_id !== userId) return null;
    return order;
  }
}

export class ProcessOrderUseCase {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly notificationPort: OrderNotificationPort
  ) {}

  async execute(orderId: number) {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) throw new ValidationError('Order not found');
    
    const fromStatus = order.status as OrderStatus;
    if (!canTransition(fromStatus, 'PROCESSING')) {
      throw new ValidationError(`Cannot process order in status ${fromStatus}`);
    }

    await this.ordersRepository.updateStatus(orderId, 'PROCESSING');
    await this.notificationPort.notifyStatusChanged({
      orderId,
      fromStatus,
      toStatus: 'PROCESSING',
      timestamp: new Date().toISOString(),
    });

    // Simular procesamiento (validación de stock, etc.)
    const items = JSON.parse(order.items);
    const processedTotal = items.reduce(
      (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
      0
    );

    await this.ordersRepository.updateStatus(orderId, 'COMPLETED');
    await this.notificationPort.notifyStatusChanged({
      orderId,
      fromStatus: 'PROCESSING',
      toStatus: 'COMPLETED',
      timestamp: new Date().toISOString(),
    });

    return { id: orderId, status: 'COMPLETED' as const, total: processedTotal };
  }
}
