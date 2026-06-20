import { RegisterUseCase } from '@/modules/auth/application/uses-cases/auth.use-cases';
import { AuthRepository } from '@/modules/auth/domain/repositories/auth.repository.interface';
import { createUser, setUserPassword } from '@/shared/infrastructure/aws/cognito';
import { ConflictError } from '@/shared/utils/error-handler.utils';

jest.mock('@/shared/infrastructure/aws/cognito', () => ({
  createUser: jest.fn(),
  setUserPassword: jest.fn(),
}));

describe('RegisterUseCase', () => {
  let registerUseCase: RegisterUseCase;
  let mockAuthRepository: jest.Mocked<AuthRepository>;

  beforeEach(() => {
    mockAuthRepository = {
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      updateCognitoSub: jest.fn(),
    };

    registerUseCase = new RegisterUseCase(mockAuthRepository);
    jest.clearAllMocks();
  });

  it('should create user successfully', async () => {
    mockAuthRepository.findByUsername.mockResolvedValue(null);
    mockAuthRepository.findByEmail.mockResolvedValue(null);
    (createUser as jest.Mock).mockResolvedValue('cognito-sub-123');
    mockAuthRepository.create.mockResolvedValue(1);

    const result = await registerUseCase.execute(
      'new@example.com',
      'newuser',
      'Password123!'
    );

    expect(mockAuthRepository.findByUsername).toHaveBeenCalledWith('newuser');
    expect(mockAuthRepository.findByEmail).toHaveBeenCalledWith('new@example.com');
    expect(createUser).toHaveBeenCalledWith('new@example.com', 'newuser', 'Password123!');
    expect(mockAuthRepository.create).toHaveBeenCalledWith({
      email: 'new@example.com',
      username: 'newuser',
      password_hash: expect.any(String),
      cognito_sub: 'cognito-sub-123',
    });
    expect(setUserPassword).toHaveBeenCalledWith('newuser', 'Password123!', true);
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
    (createUser as jest.Mock).mockResolvedValue(undefined);

    await expect(registerUseCase.execute('test@test.com', 'testuser', 'Password123!'))
      .rejects
      .toThrow('Error creating user in Cognito');
  });
});
