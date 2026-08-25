import { describe, expect, it, vi } from 'vitest';
import { TauriSqlExecutor } from '../repositories/tauriSqlExecutor';

describe('TauriSqlExecutor', () => {
  it('sends all transaction statements to one Rust command in order', async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    const database = {
      select: vi.fn(),
      execute: vi.fn(),
    };
    const executor = new TauriSqlExecutor(database, invoke);

    await executor.transaction(async (transaction) => {
      await transaction.execute('INSERT INTO records VALUES (?)', ['record-1']);
      await transaction.execute('INSERT INTO record_fields VALUES (?, ?)', ['field-1', 'record-1']);
    });

    expect(invoke).toHaveBeenCalledWith('execute_transaction', {
      statements: [
        { sql: 'INSERT INTO records VALUES (?)', params: ['record-1'] },
        {
          sql: 'INSERT INTO record_fields VALUES (?, ?)',
          params: ['field-1', 'record-1'],
        },
      ],
    });
    expect(database.execute).not.toHaveBeenCalled();
  });

  it('does not invoke Rust when transaction preparation fails', async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    const executor = new TauriSqlExecutor({ select: vi.fn(), execute: vi.fn() }, invoke);

    await expect(
      executor.transaction(async () => {
        throw new Error('prepare failed');
      }),
    ).rejects.toThrow('prepare failed');

    expect(invoke).not.toHaveBeenCalled();
  });
});
