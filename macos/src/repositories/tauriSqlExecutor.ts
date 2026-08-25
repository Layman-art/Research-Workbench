import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import type { SqlExecutor, SqlResult } from './SqliteWorkbenchRepository';

interface DatabaseClient {
  select<T>(sql: string, params?: unknown[]): Promise<T>;
  execute(sql: string, params?: unknown[]): Promise<SqlResult>;
}

interface SqlStatement {
  sql: string;
  params: unknown[];
}

type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

export class TauriSqlExecutor implements SqlExecutor {
  constructor(
    private readonly database: DatabaseClient,
    private readonly invokeCommand: Invoke = invoke,
  ) {}

  async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.database.select<T[]>(sql, params);
  }

  async execute(sql: string, params: unknown[] = []): Promise<SqlResult> {
    return this.database.execute(sql, params);
  }

  async transaction<T>(work: (transaction: SqlExecutor) => Promise<T>): Promise<T> {
    const statements: SqlStatement[] = [];
    const transaction: SqlExecutor = {
      select: async () => {
        throw new Error('事务准备阶段不支持查询');
      },
      execute: async (sql, params = []) => {
        statements.push({ sql, params });
        return { rowsAffected: 0 };
      },
      transaction: async () => {
        throw new Error('不支持嵌套事务');
      },
    };
    const result = await work(transaction);
    await this.invokeCommand('execute_transaction', { statements });
    return result;
  }
}

export async function createTauriSqlExecutor(): Promise<SqlExecutor> {
  const databaseUrl = await invoke<string>('get_database_url');
  const database = await Database.load(databaseUrl);
  return new TauriSqlExecutor(database);
}
