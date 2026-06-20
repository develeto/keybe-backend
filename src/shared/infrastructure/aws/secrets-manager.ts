import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { InMemoryCache } from '../cache/in-memory-cache';

const client = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const cache = InMemoryCache.getInstance();
const CACHE_PREFIX = 'secret:';
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getSecret(secretId: string): Promise<string> {
  const cacheKey = `${CACHE_PREFIX}${secretId}`;
  const cached = cache.get<string>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const command = new GetSecretValueCommand({ SecretId: secretId });
  const response = await client.send(command);
  if (!response.SecretString) {
    throw new Error(`Secret ${secretId} has no SecretString`);
  }

  cache.set(cacheKey, response.SecretString, DEFAULT_TTL_MS);
  return response.SecretString;
}

export async function getSecretJson<T = Record<string, string>>(
  secretId: string
): Promise<T> {
  const secret = await getSecret(secretId);
  return JSON.parse(secret) as T;
}
