import { OrderNotificationPort, OrderStatusChangedEvent } from '@/shared/domain/ports/order-notification.port';
import { publishToTopic } from '@/shared/infrastructure/aws/sns';

export class OrderNotificationAdapter implements OrderNotificationPort {
  async notifyStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    const topicArn = process.env.ORDER_STATUS_CHANGED_TOPIC_ARN;
    if (!topicArn) return;

    await publishToTopic(
      topicArn,
      {
        event: 'order.status.changed',
        ...event,
      },
      `Order #${event.orderId} status changed to ${event.toStatus}`
    );
  }
}
