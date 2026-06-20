import { LoginUseCase } from '@/modules/auth/application/uses-cases/auth.use-cases';
import { AuthRepository } from '@/modules/auth/domain/repositories/auth.repository.interface';
import { AuthProviderPort } from '@/shared/domain/ports/auth-provider.port';
import { UnauthorizedError } from '@/shared/utils/error-handler.utils';
import bcrypt from 'bcryptjs';

describe('LoginUseCase', () => {
  let loginUseCase: LoginUseCase;
  let mockAuthRepository: jest.Mocked<AuthRepository>;
  let mockAuthProvider: jest.Mocked<AuthProviderPort>;

  const validHash = bcrypt.hashSync('Password123!', 10);
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    username: 'testuser',
    password_hash: validHash,
    status: 'ACTIVE',
    cognito_sub: 'sub-123',
  };

  beforeEach(() => {
    mockAuthRepository = {
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      updateCognitoSub: jest.fn(),
    };

    mockAuthProvider = {
      login: jest.fn(),
      createUser: jest.fn(),
      setUserPassword: jest.fn(),
    };

    loginUseCase = new LoginUseCase(mockAuthRepository, mockAuthProvider);
    jest.clearAllMocks();
  });

  it('should return token and user on successful login', async () => {
    const mockAuthResult = {
      accessToken: 'mock-access-token',
      idToken: 'mock-id-token',
      refreshToken: 'mock-refresh-token',
    };

    const mockLoginResponse = {
      tokens: mockAuthResult,
      username: 'testuser',
    };

    mockAuthRepository.findByUsername.mockResolvedValue(mockUser as any);
    mockAuthProvider.login.mockResolvedValue(mockLoginResponse);

    const result = await loginUseCase.execute('testuser', 'Password123!');

    expect(mockAuthRepository.findByUsername).toHaveBeenCalledWith('testuser');
    expect(mockAuthProvider.login).toHaveBeenCalledWith('testuser', 'Password123!');
    expect(result).toEqual({
      token: mockAuthResult,
      user: {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        status: 'ACTIVE',
      },
    });
  });

  it('should throw UnauthorizedError when user is not found', async () => {
    mockAuthRepository.findByUsername.mockResolvedValue(null);

    await expect(loginUseCase.execute('unknown', 'Password123!'))
      .rejects
      .toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when password is incorrect', async () => {
    const differentHash = bcrypt.hashSync('OtherPass1!', 10);
    const userWithDifferentPassword = {
      ...mockUser,
      password_hash: differentHash,
    };
    mockAuthRepository.findByUsername.mockResolvedValue(userWithDifferentPassword as any);

    await expect(loginUseCase.execute('testuser', 'WrongPassword'))
      .rejects
      .toThrow(UnauthorizedError);
  });
});
