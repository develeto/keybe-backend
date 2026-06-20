export interface OrderMetrics {
  totalOrders: number;
  pendingOrders: number;
  completedToday: number;
}

export interface MetricsRepository {
  getOrderMetrics(): Promise<OrderMetrics>;
}
