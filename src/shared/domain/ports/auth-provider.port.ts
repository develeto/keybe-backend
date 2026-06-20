export interface AuthTokens {
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
}

export interface LoginResult {
  tokens?: AuthTokens;
  username?: string;
}

export interface AuthProviderPort {
  login(username: string, password: string): Promise<LoginResult>;
  createUser(email: string, username: string, password: string): Promise<string>;
  setUserPassword(username: string, password: string, permanent?: boolean): Promise<void>;
}
