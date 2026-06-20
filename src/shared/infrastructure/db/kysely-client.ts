import { Kysely, MysqlDialect, MysqlPool } from 'kysely';
import { createPool } from 'mysql2';
import type { OrderFlowDatabase } from './models';

let dbInstance: Kysely<OrderFlowDatabase> | null = null;

export async function getDatabaseInstance(): Promise<Kysely<OrderFlowDatabase>> {
  if (dbInstance) return dbInstance;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not defined');
  }

  const url = new URL(connectionString);
  const pool = createPool({
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit: 2,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,
    waitForConnections: true,
    queueLimit: 10,
    connectTimeout: 10000,
  }) as MysqlPool;

  dbInstance = new Kysely<OrderFlowDatabase>({
    dialect: new MysqlDialect({ pool }),
  });

  return dbInstance;
}

export async function resetDatabaseInstance(): Promise<void> {
  if (dbInstance) {
    await dbInstance.destroy().catch(() => null);
    dbInstance = null;
  }
}
