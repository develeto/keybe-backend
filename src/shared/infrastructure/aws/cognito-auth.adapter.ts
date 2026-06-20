import {
  AuthProviderPort,
  LoginResult,
} from '@/shared/domain/ports/auth-provider.port';
import {
  loginUser,
  createUser,
  setUserPassword,
} from '@/shared/infrastructure/aws/cognito';

export class CognitoAuthAdapter implements AuthProviderPort {
  async login(username: string, password: string): Promise<LoginResult> {
    const result = await loginUser(username, password);
    const auth = result.AuthenticationResult;
    return {
      tokens: auth
        ? {
            accessToken: auth.AccessToken,
            idToken: auth.IdToken,
            refreshToken: auth.RefreshToken,
            expiresIn: auth.ExpiresIn,
            tokenType: auth.TokenType,
          }
        : undefined,
      username: result.ChallengeName ? username : undefined,
    };
  }

  async createUser(
    email: string,
    username: string,
    password: string
  ): Promise<string> {
    const sub = await createUser(email, username, password);
    if (!sub) throw new Error('Error creating user in Cognito');
    return sub;
  }

  async setUserPassword(
    username: string,
    password: string,
    permanent = true
  ): Promise<void> {
    await setUserPassword(username, password, permanent);
  }
}
