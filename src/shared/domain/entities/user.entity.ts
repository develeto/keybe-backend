export interface UserEntity {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  cognito_sub: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserPublicProfile {
  id: number;
  email: string;
  username: string;
  status: string;
}
