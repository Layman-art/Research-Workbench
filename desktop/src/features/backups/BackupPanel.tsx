import { useCallback, useEffect, useState } from 'react';
import { desktopPlatform } from '../../platform';
import { confirmDialog } from '../../confirmBus';
import { backupService, type StorageInfo } from './backupService';
import { flushPendingDrafts } from '../drafts/draftLifecycle';
import { useStore } from '../../stores';

const size = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

export function BackupPanel({ recovery = false }: { recovery?: boolean }) {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [restorePending, setRestorePending] = useState(false);
  const refresh = useCallback(() => {
    void backupService.info().then(setInfo).catch((error: unknown) => setMessage(String(error)));
  }, []);
  useEffect(refresh, [refresh]);
  if (!desktopPlatform.isDesktop) return null;

  const restore = async (name: string) => {
    const question = '恢复此备份会替换当前数据并重新启动。当前数据会先保留为恢复点，确定继续？';
    const confirmed = recovery ? window.confirm(question) : await confirmDialog({ message: question, confirmLabel: '恢复并重启', danger: true });
    if (!confirmed) return;
    setBusy(true);
    let staged = false;
    try {
      await flushPendingDrafts();
      await useStore.getState().whenIdle();
      await backupService.restore(name);
      staged = true;
      setRestorePending(true);
      await backupService.finishExit(true);
    } catch (error) {
      setMessage(staged ? `恢复已安排，但自动重启失败：${String(error)}。请重新启动完成恢复；此后编辑的内容不会包含在所选备份中。` : `恢复失败：${String(error)}`);
      setBusy(false);
    }
  };

  return <section className="card settings-section">
    <h3>{recovery ? '从自动备份恢复' : '自动备份与恢复'}</h3>
    <p className="desc">每天自动备份，保留最近 30 份。备份包含记录、回收站、草稿和活动历史；外部文件只保存路径引用。</p>
    {info && <>
      <p className="desc" style={{ overflowWrap: 'anywhere' }}>{info.directory}</p>
      <p>数据库 {size(info.databaseBytes)} · 备份 {size(info.backupBytes)}</p>
    </>}
    <div className="data-actions">
      {!recovery && <button className="btn btn-ghost" disabled={busy || restorePending} onClick={() => {
        setBusy(true);
        void flushPendingDrafts().then(() => useStore.getState().whenIdle()).then(() => backupService.create('manual')).then(() => { setMessage('备份已创建并通过完整性校验'); refresh(); })
          .catch((error: unknown) => setMessage(`备份失败：${String(error)}`)).finally(() => setBusy(false));
      }}>立即备份</button>}
      <button className="btn btn-ghost" onClick={() => void desktopPlatform.openDataDirectory().catch((error: unknown) => setMessage(String(error)))}>打开数据目录</button>
    </div>
    <details style={{ marginTop: 12 }} open={recovery}>
      <summary>恢复历史备份（{info?.backups.length ?? 0}）</summary>
      {info?.backups.map((backup) => <div className="manage-row" key={backup.name}>
        <span style={{ flex: 1, overflowWrap: 'anywhere' }}>{new Date(backup.createdAt).toLocaleString()} · {size(backup.bytes)}</span>
        <button className="btn btn-ghost btn-sm" disabled={busy || restorePending} onClick={() => void restore(backup.name)}>恢复</button>
      </div>)}
    </details>
    {restorePending && <button className="btn btn-primary" disabled={busy} onClick={() => {
      setBusy(true);
      void backupService.finishExit(true).catch((error: unknown) => {
        setMessage(`恢复已安排，仍无法自动重启：${String(error)}。请退出后重新打开应用完成恢复。`);
        setBusy(false);
      });
    }}>重试重启并完成恢复</button>}
    {message && <p role="status">{message}</p>}
  </section>;
}
