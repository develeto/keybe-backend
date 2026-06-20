import { ScheduledHandler, EventBridgeEvent } from 'aws-lambda';
import { reportMetricsUseCase } from '@/modules/orders/config/dependencies';
import logger from '@/shared/utils/logger.utils';

export const reportMetrics: ScheduledHandler = async (_event: EventBridgeEvent<'Scheduled Event', unknown>) => {
  try {
    const metrics = await reportMetricsUseCase.execute();

    logger.info({
      message: 'Metrics report',
      metrics,
    });
  } catch (error) {
    logger.error({ error, message: 'Failed to generate metrics report' });
  }
};
