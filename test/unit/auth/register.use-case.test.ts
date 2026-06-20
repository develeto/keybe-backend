import { RegisterUseCase } from '@/modules/auth/application/uses-cases/auth.use-cases';
import { AuthRepository } from '@/modules/auth/domain/repositories/auth.repository.interface';
import { AuthProviderPort } from '@/shared/domain/ports/auth-provider.port';
import { ConflictError } from '@/shared/utils/error-handler.utils';

describe('RegisterUseCase', () => {
  let registerUseCase: RegisterUseCase;
  let mockAuthRepository: jest.Mocked<AuthRepository>;
  let mockAuthProvider: jest.Mocked<AuthProviderPort>;

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

    registerUseCase = new RegisterUseCase(mockAuthRepository, mockAuthProvider);
    jest.clearAllMocks();
  });

  it('should create user successfully', async () => {
    mockAuthRepository.findByUsername.mockResolvedValue(null);
    mockAuthRepository.findByEmail.mockResolvedValue(null);
    mockAuthProvider.createUser.mockResolvedValue('cognito-sub-123');
    mockAuthRepository.create.mockResolvedValue(1);

    const result = await registerUseCase.execute(
      'new@example.com',
      'newuser',
      'Password123!'
    );

    expect(mockAuthRepository.findByUsername).toHaveBeenCalledWith('newuser');
    expect(mockAuthRepository.findByEmail).toHaveBeenCalledWith('new@example.com');
    expect(mockAuthProvider.createUser).toHaveBeenCalledWith('new@example.com', 'newuser', 'Password123!');
    expect(mockAuthRepository.create).toHaveBeenCalledWith({
      email: 'new@example.com',
      username: 'newuser',
      password_hash: expect.any(String),
      cognito_sub: 'cognito-sub-123',
    });
    expect(mockAuthProvider.setUserPassword).toHaveBeenCalledWith('newuser', 'Password123!', true);
    expect(result).toEqual({ id: 1, email: 'new@example.com', username: 'newuser' });
  });

  it('should throw ConflictError when username already exists', async () => {
    mockAuthRepository.findByUsername.mockResolvedValue({ id: 1 } as any);

    await expect(registerUseCase.execute('test@test.com', 'existing', 'Password123!'))
      .rejects
      .toThrow(ConflictError);
  });

  it('should throw ConflictError when email already exists', async () => {
    mockAuthRepository.findByUsername.mockResolvedValue(null);
    mockAuthRepository.findByEmail.mockResolvedValue({ id: 1 } as any);

    await expect(registerUseCase.execute('existing@test.com', 'newuser', 'Password123!'))
      .rejects
      .toThrow(ConflictError);
  });

  it('should throw error when Cognito user creation fails', async () => {
    mockAuthRepository.findByUsername.mockResolvedValue(null);
    mockAuthRepository.findByEmail.mockResolvedValue(null);
    mockAuthProvider.createUser.mockRejectedValue(new Error('Error creating user in Cognito'));

    await expect(registerUseCase.execute('test@test.com', 'testuser', 'Password123!'))
      .rejects
      .toThrow('Error creating user in Cognito');
  });
});
