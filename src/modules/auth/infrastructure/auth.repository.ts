import { AuthRepository } from '@/modules/auth/domain/repositories/auth.repository.interface';
import { getDatabaseInstance } from '@/shared/infrastructure/db/kysely-client';
import { sql } from 'kysely';

export class AuthDbRepository implements AuthRepository {
  async findByUsername(username: string) {
    const db = await getDatabaseInstance();
    const result = await db
      .selectFrom('users')
      .selectAll()
      .where('username', '=', username)
      .executeTakeFirst();
    return result || null;
  }

  async findByEmail(email: string) {
    const db = await getDatabaseInstance();
    const result = await db
      .selectFrom('users')
      .select(['id', 'email', 'username', 'status'])
      .where('email', '=', email)
      .executeTakeFirst();
    return result || null;
  }

  async create(data: {
    email: string;
    username: string;
    password_hash: string;
    cognito_sub: string;
  }): Promise<number> {
    const db = await getDatabaseInstance();
    const result = await db
      .insertInto('users')
      .values({
        email: data.email,
        username: data.username,
        password_hash: data.password_hash,
        status: 'ACTIVE',
        cognito_sub: data.cognito_sub,
        created_at: sql`NOW()`,
        updated_at: sql`NOW()`,
      })
      .executeTakeFirst();
    return Number(result.insertId);
  }

  async updateCognitoSub(userId: number, cognitoSub: string): Promise<void> {
    const db = await getDatabaseInstance();
    await db
      .updateTable('users')
      .set({ cognito_sub: cognitoSub, updated_at: sql`NOW()` })
      .where('id', '=', userId)
      .execute();
  }
}
