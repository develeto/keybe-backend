import { SQSEvent, Context } from 'aws-lambda';
import { processOrderUseCase } from '@/modules/orders/config/dependencies';
import logger from '@/shared/utils/logger.utils';

export const processOrderHandler = async (
  event: SQSEvent,
  _context: Context
): Promise<void> => {
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      logger.info({ message: 'Processing order', orderId: body.orderId });

      if (body.action === 'PROCESS_ORDER') {
        await processOrderUseCase.execute(body.orderId);
        logger.info({ message: 'Order processed successfully', orderId: body.orderId });
      }
    } catch (error) {
      logger.error({ error, message: 'Failed to process order from SQS', record: record.body });
      throw error;
    }
  }
};
