import { MetricsRepository, OrderMetrics } from '../../domain/repositories/metrics.repository.interface';

export class ReportMetricsUseCase {
  constructor(private readonly metricsRepository: MetricsRepository) {}

  async execute(): Promise<OrderMetrics> {
    return this.metricsRepository.getOrderMetrics();
  }
}
