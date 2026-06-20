export interface AuthRepository {
  findByUsername(username: string): Promise<{
    id: number;
    email: string;
    username: string;
    password_hash: string;
    status: string;
    cognito_sub: string | null;
  } | null>;
  findByEmail(email: string): Promise<{
    id: number;
    email: string;
    username: string;
    status: string;
  } | null>;
  create(data: {
    email: string;
    username: string;
    password_hash: string;
    cognito_sub: string;
  }): Promise<number>;
  updateCognitoSub(userId: number, cognitoSub: string): Promise<void>;
}
