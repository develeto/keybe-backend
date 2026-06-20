import { UserLookupPort } from '@/shared/domain/ports/user-lookup.port';
import { Kysely } from 'kysely';
import type { OrderFlowDatabase } from '@/shared/infrastructure/db/models';

export class UserLookupAdapter implements UserLookupPort {
  constructor(private readonly db: Kysely<OrderFlowDatabase>) {}

  async findByCognitoSub(cognitoSub: string): Promise<number | null> {
    const result = await this.db
      .selectFrom('users')
      .select('id')
      .where('cognito_sub', '=', cognitoSub)
      .executeTakeFirst();
    return result?.id ?? null;
  }
}
