import { AuthDbRepository } from '@/modules/auth/infrastructure/auth.repository';
import { LoginUseCase, RegisterUseCase } from '@/modules/auth/application/uses-cases/auth.use-cases';

const authRepository = new AuthDbRepository();

export const loginUseCase = new LoginUseCase(authRepository);
export const registerUseCase = new RegisterUseCase(authRepository);
