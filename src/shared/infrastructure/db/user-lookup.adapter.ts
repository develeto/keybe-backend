import { UserLookupPort } from '@/shared/domain/ports/user-lookup.port';
import { getDatabaseInstance } from '@/shared/infrastructure/db/kysely-client';

export class UserLookupAdapter implements UserLookupPort {
  async findByCognitoSub(cognitoSub: string): Promise<number | null> {
    const db = await getDatabaseInstance();
    const result = await db
      .selectFrom('users')
      .select('id')
      .where('cognito_sub', '=', cognitoSub)
      .executeTakeFirst();
    return result?.id ?? null;
  }
}
