import { AdminOrdersRepository } from '@/modules/admin/domain/repositories/admin.repository.interface';
import { OrderStatus, canTransition } from '@/shared/domain/value-objects/order-status';
import { ValidationError } from '@/shared/utils/error-handler.utils';
import { OrderNotificationPort } from '@/shared/domain/ports/order-notification.port';

export class AdminListOrdersUseCase {
  constructor(private readonly adminRepository: AdminOrdersRepository) {}

  async execute(limit = 20, offset = 0, statusFilter?: OrderStatus) {
    return this.adminRepository.findAll(limit, offset, statusFilter);
  }
}

export class AdminUpdateOrderStatusUseCase {
  constructor(
    private readonly adminRepository: AdminOrdersRepository,
    private readonly notificationPort: OrderNotificationPort
  ) {}

  async execute(orderId: number, newStatus: OrderStatus) {
    const order = await this.adminRepository.findById(orderId);
    if (!order) {
      throw new ValidationError('Order not found');
    }

    const fromStatus = order.status as OrderStatus;
    if (!canTransition(fromStatus, newStatus)) {
      throw new ValidationError(
        `Cannot transition from ${fromStatus} to ${newStatus}`
      );
    }

    await this.adminRepository.updateStatus(orderId, newStatus);

    await this.notificationPort.notifyStatusChanged({
      orderId,
      fromStatus,
      toStatus: newStatus,
      timestamp: new Date().toISOString(),
    });

    return { id: orderId, status: newStatus };
  }
}
