export interface UserLookupPort {
  findByCognitoSub(cognitoSub: string): Promise<number | null>;
}
