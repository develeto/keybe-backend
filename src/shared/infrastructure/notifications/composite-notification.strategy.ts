import { OrderNotificationPort, OrderStatusChangedEvent } from '@/shared/domain/ports/order-notification.port';

export class CompositeNotificationStrategy implements OrderNotificationPort {
  constructor(private readonly channels: OrderNotificationPort[]) {}

  async notifyStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    await Promise.all(
      this.channels.map((ch) => ch.notifyStatusChanged(event))
    );
  }
}
