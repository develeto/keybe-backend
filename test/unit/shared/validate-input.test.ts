import { validateInput } from '@/shared/utils/validate-input.utils';
import { z } from 'zod';

describe('validateInput', () => {
  const TestSchema = z.object({
    name: z.string(),
    age: z.number().min(0),
  });

  it('should pass validation and return typed data', () => {
    const payload = { name: 'John', age: 30 };
    const result = validateInput(TestSchema, payload);
    expect(result).toEqual({ name: 'John', age: 30 });
  });

  it('should throw ZodError on invalid input', () => {
    const payload = { name: 123, age: -5 };
    expect(() => validateInput(TestSchema, payload)).toThrow(z.ZodError);
  });

  it('should throw on missing required field', () => {
    const payload = { name: 'John' };
    expect(() => validateInput(TestSchema, payload)).toThrow(z.ZodError);
  });
});
