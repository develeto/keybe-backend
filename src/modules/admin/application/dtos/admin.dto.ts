import { z } from 'zod';

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['VALIDATING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED']),
});

export type TUpdateOrderStatusDto = z.infer<typeof UpdateOrderStatusSchema>;
