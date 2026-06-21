import { ReportMetricsUseCase } from '@/modules/orders/application/uses-cases/report-metrics.use-case';
import { MetricsRepository } from '@/modules/orders/domain/repositories/metrics.repository.interface';

describe('ReportMetricsUseCase', () => {
  let useCase: ReportMetricsUseCase;
  let mockRepo: jest.Mocked<MetricsRepository>;

  beforeEach(() => {
    mockRepo = {
      getOrderMetrics: jest.fn(),
    };
    useCase = new ReportMetricsUseCase(mockRepo);
  });

  it('should return order metrics', async () => {
    const expected = {
      totalOrders: 100,
      pendingOrders: 10,
      completedToday: 5,
    };
    mockRepo.getOrderMetrics.mockResolvedValue(expected);

    const result = await useCase.execute();

    expect(mockRepo.getOrderMetrics).toHaveBeenCalled();
    expect(result).toEqual(expected);
  });
});
