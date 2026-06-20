import { AuthRepository } from '../../domain/repositories/auth.repository.interface';
import { AuthProviderPort } from '@/shared/domain/ports/auth-provider.port';
import { UnauthorizedError, ConflictError } from '@/shared/utils/error-handler.utils';
import bcrypt from 'bcryptjs';

export class LoginUseCase {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly authProvider: AuthProviderPort
  ) {}

  async execute(username: string, password: string) {
    const user = await this.authRepository.findByUsername(username);
    if (!user) {
      throw new UnauthorizedError('Usuario o contraseña incorrectos');
    }

    const passwordValid = bcrypt.compareSync(password, user.password_hash);
    if (!passwordValid) {
      throw new UnauthorizedError('Usuario o contraseña incorrectos');
    }

    const authResult = await this.authProvider.login(user.username, password);

    return {
      token: authResult.tokens,
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
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly authProvider: AuthProviderPort
  ) {}

  async execute(email: string, username: string, password: string) {
    const existingUser = await this.authRepository.findByUsername(username);
    if (existingUser) {
      throw new ConflictError('El usuario ya existe');
    }

    const existingEmail = await this.authRepository.findByEmail(email);
    if (existingEmail) {
      throw new ConflictError('El email ya está registrado');
    }

    const cognitoSub = await this.authProvider.createUser(email, username, password);

    const passwordHash = bcrypt.hashSync(password, 10);
    const userId = await this.authRepository.create({
      email,
      username,
      password_hash: passwordHash,
      cognito_sub: cognitoSub,
    });

    await this.authProvider.setUserPassword(username, password, true);

    return { id: userId, email, username };
  }
}
