import { AdminDbRepository } from '@/modules/admin/infrastructure/db/admin.repository';
import { AdminListOrdersUseCase, AdminUpdateOrderStatusUseCase } from '@/modules/admin/application/uses-cases/admin.use-cases';
import { OrderNotificationAdapter } from '@/shared/infrastructure/notifications/order-notification.adapter';
import { LogNotificationStrategy } from '@/shared/infrastructure/notifications/log-notification.strategy';
import { CompositeNotificationStrategy } from '@/shared/infrastructure/notifications/composite-notification.strategy';
import { getDatabaseInstance } from '@/shared/infrastructure/db/kysely-client';

const db = getDatabaseInstance();
const adminOrdersRepository = new AdminDbRepository(db);

const notificationStrategy = new CompositeNotificationStrategy([
  new OrderNotificationAdapter(),
  new LogNotificationStrategy(),
]);

export const listOrdersUseCase = new AdminListOrdersUseCase(adminOrdersRepository);
export const updateStatusUseCase = new AdminUpdateOrderStatusUseCase(adminOrdersRepository, notificationStrategy);

export default adminOrdersRepository;
