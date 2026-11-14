import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ restore: vi.fn(), finishExit: vi.fn() }));
vi.mock('../platform', () => ({ desktopPlatform: { isDesktop: true, openDataDirectory: vi.fn() } }));
vi.mock('../confirmBus', () => ({ confirmDialog: vi.fn().mockResolvedValue(true) }));
vi.mock('../features/backups/backupService', () => ({ backupService: {
  info: vi.fn().mockResolvedValue({ directory: '/data', databaseBytes: 1, backupBytes: 1, backups: [{ name: 'safe.sqlite', bytes: 1, createdAt: 1 }] }),
  create: vi.fn(), restore: mocks.restore, finishExit: mocks.finishExit,
} }));
import { BackupPanel } from '../features/backups/BackupPanel';
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('keeps a staged restore explicit and retries only restart after restart fails', async () => {
  mocks.restore.mockResolvedValue(undefined);
  mocks.finishExit.mockRejectedValue(new Error('IPC failure'));
  render(<BackupPanel />);
  fireEvent.click(await screen.findByRole('button', { name: '恢复', hidden: true }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('恢复已安排'));
  expect(screen.getByRole('button', { name: '恢复', hidden: true })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '重试重启并完成恢复' }));
  await waitFor(() => expect(mocks.finishExit).toHaveBeenCalledTimes(2));
  expect(mocks.restore).toHaveBeenCalledTimes(1);
});
