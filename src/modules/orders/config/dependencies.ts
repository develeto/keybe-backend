import { OrdersDbRepository } from '@/modules/orders/infrastructure/db/orders.repository';
import { ProductsDbRepository } from '@/modules/products/infrastructure/db/products.repository';
import { UserLookupAdapter } from '@/shared/infrastructure/db/user-lookup.adapter';
import { CreateOrderUseCase, ListOrdersUseCase, GetOrderUseCase, ProcessOrderUseCase } from '@/modules/orders/application/uses-cases/order.use-cases';
import { MetricsDbRepository } from '@/modules/orders/infrastructure/db/metrics.repository';
import { ReportMetricsUseCase } from '@/modules/orders/application/uses-cases/report-metrics.use-case';
import { OrderNotificationAdapter } from '@/shared/infrastructure/notifications/order-notification.adapter';
import { LogNotificationStrategy } from '@/shared/infrastructure/notifications/log-notification.strategy';
import { CompositeNotificationStrategy } from '@/shared/infrastructure/notifications/composite-notification.strategy';
import { getDatabaseInstance } from '@/shared/infrastructure/db/kysely-client';

const db = getDatabaseInstance();
const ordersRepository = new OrdersDbRepository(db);
const metricsRepository = new MetricsDbRepository(db);
const productsRepository = new ProductsDbRepository(db);

const notificationStrategy = new CompositeNotificationStrategy([
  new OrderNotificationAdapter(),
  new LogNotificationStrategy(),
]);

export const userLookupAdapter = new UserLookupAdapter(db);

export const createOrderUseCase = new CreateOrderUseCase(ordersRepository, productsRepository);
export const listOrdersUseCase = new ListOrdersUseCase(ordersRepository);
export const getOrderUseCase = new GetOrderUseCase(ordersRepository);
export const processOrderUseCase = new ProcessOrderUseCase(ordersRepository, notificationStrategy);
export const reportMetricsUseCase = new ReportMetricsUseCase(metricsRepository);

export default ordersRepository;
