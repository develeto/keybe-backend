export interface OrderStatusChangedEvent {
  orderId: number;
  fromStatus: string;
  toStatus: string;
  timestamp: string;
}

export interface OrderNotificationPort {
  notifyStatusChanged(event: OrderStatusChangedEvent): Promise<void>;
}
