import { ZodSchema } from 'zod';

export function validateInput<T>(schema: ZodSchema<T>, payload: unknown): T {
  return schema.parse(payload);
}
