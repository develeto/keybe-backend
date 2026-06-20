import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string({ required_error: 'username is required' }),
  password: z.string({ required_error: 'password is required' }).min(1),
});

export type TLoginDto = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  email: z.string({ required_error: 'email is required' }).email('Invalid email format'),
  username: z.string({ required_error: 'username is required' }).min(3).max(50),
  password: z
    .string({ required_error: 'password is required' })
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export type TRegisterDto = z.infer<typeof RegisterSchema>;
