import { OrderNotificationPort, OrderStatusChangedEvent } from '@/shared/domain/ports/order-notification.port';
import logger from '@/shared/utils/logger.utils';

export class LogNotificationStrategy implements OrderNotificationPort {
  async notifyStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    logger.info({ ...event, message: 'Order status changed (log channel)' });
  }
}
