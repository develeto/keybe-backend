import { AuthDbRepository } from '@/modules/auth/infrastructure/auth.repository';
import { CognitoAuthAdapter } from '@/shared/infrastructure/aws/cognito-auth.adapter';
import { LoginUseCase, RegisterUseCase } from '@/modules/auth/application/uses-cases/auth.use-cases';
import { getDatabaseInstance } from '@/shared/infrastructure/db/kysely-client';

const db = getDatabaseInstance();
const authRepository = new AuthDbRepository(db);
const authProvider = new CognitoAuthAdapter();

export const loginUseCase = new LoginUseCase(authRepository, authProvider);
export const registerUseCase = new RegisterUseCase(authRepository, authProvider);
