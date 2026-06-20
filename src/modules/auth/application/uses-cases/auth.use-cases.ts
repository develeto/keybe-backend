import { AuthRepository } from '../../domain/repositories/auth.repository.interface';
import { loginUser, createUser, setUserPassword } from '@/shared/infrastructure/aws/cognito';
import { UnauthorizedError, ConflictError } from '@/shared/utils/error-handler.utils';
import bcrypt from 'bcryptjs';

export class LoginUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(username: string, password: string) {
    const user = await this.authRepository.findByUsername(username);
    if (!user) {
      throw new UnauthorizedError('Usuario o contraseña incorrectos');
    }

    const passwordValid = bcrypt.compareSync(password, user.password_hash);
    if (!passwordValid) {
      throw new UnauthorizedError('Usuario o contraseña incorrectos');
    }

    const cognitoResult = await loginUser(user.username, password);

    return {
      token: cognitoResult.AuthenticationResult ?? undefined,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        status: user.status,
      },
    };
  }
}

export class RegisterUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(email: string, username: string, password: string) {
    const existingUser = await this.authRepository.findByUsername(username);
    if (existingUser) {
      throw new ConflictError('El usuario ya existe');
    }

    const existingEmail = await this.authRepository.findByEmail(email);
    if (existingEmail) {
      throw new ConflictError('El email ya está registrado');
    }

    const cognitoSub = await createUser(email, username, password);
    if (!cognitoSub) {
      throw new Error('Error creating user in Cognito');
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const userId = await this.authRepository.create({
      email,
      username,
      password_hash: passwordHash,
      cognito_sub: cognitoSub,
    });

    await setUserPassword(username, password, true);

    return { id: userId, email, username };
  }
}
