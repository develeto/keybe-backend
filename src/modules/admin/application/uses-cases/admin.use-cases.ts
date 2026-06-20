import { AdminOrdersRepository } from '@/modules/admin/domain/repositories/admin.repository.interface';
import { OrderStatus, canTransition } from '@/shared/domain/value-objects/order-status';
import { ValidationError } from '@/shared/utils/error-handler.utils';

export class AdminListOrdersUseCase {
  constructor(private readonly adminRepository: AdminOrdersRepository) {}

  async execute(limit = 20, offset = 0, statusFilter?: OrderStatus) {
    return this.adminRepository.findAll(limit, offset, statusFilter);
  }
}

export class AdminUpdateOrderStatusUseCase {
  constructor(private readonly adminRepository: AdminOrdersRepository) {}

  async execute(orderId: number, newStatus: OrderStatus) {
    const order = await this.adminRepository.findById(orderId);
    if (!order) {
      throw new ValidationError('Order not found');
    }

    if (!canTransition(order.status as OrderStatus, newStatus)) {
      throw new ValidationError(
        `Cannot transition from ${order.status} to ${newStatus}`
      );
    }

    await this.adminRepository.updateStatus(orderId, newStatus);
    return { id: orderId, status: newStatus };
  }
}
