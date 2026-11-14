import { useRef, useState } from 'react';
import { Download, Upload, RotateCcw } from 'lucide-react';
import { useStore } from '../../stores';
import { validateImportData, type ImportValidation } from '../../stores/workbenchStore';
import { desktopPlatform } from '../../platform';
import { confirmDialog } from '../../confirmBus';
import type { ExportFormat } from '../export/exportService';
import { backupService } from './backupService';
import { flushPendingDrafts } from '../drafts/draftLifecycle';

export function DataManager() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Extract<ImportValidation, { ok: true }> | null>(null);
  const [payload, setPayload] = useState<unknown>(null);

  const onExport = async (format: ExportFormat) => {
    setBusy(true);
    try {
      await useStore.getState().whenIdle();
      const { exportSnapshot } = await import('../export/exportService');
      const state = useStore.getState();
      if (!state.settings) throw new Error('尚未完成初始化');
      const result = await exportSnapshot(format, state.exportData(), desktopPlatform);
      if (result.status === 'saved') setMessage(`已保存：${result.filename}`);
    } catch (error) { setMessage(`导出失败：${String(error)}`); }
    finally { setBusy(false); }
  };

  const inspect = async (file: File) => {
    setPreview(null);
    setPayload(null);
    if (file.size > 100 * 1024 * 1024) { setMessage('请选择不超过 100 MB 的 JSON 备份；更大的数据请使用数据库备份恢复。'); return; }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const result = validateImportData(parsed, useStore.getState().settings ?? undefined);
      if (!result.ok) { setMessage(`导入校验失败：${result.error}`); return; }
      setPayload(parsed);
      setPreview(result);
      setMessage('备份校验通过。请核对下方数量后再恢复。');
    } catch (error) { setMessage(`无法读取 JSON 备份：${String(error)}`); }
  };

  const replaceData = async (reset: boolean) => {
    const confirmed = await confirmDialog({
      message: reset ? '将当前数据替换为示例数据。桌面版会先创建恢复点，是否继续？' : '将当前数据替换为所选备份。桌面版会先创建恢复点，是否继续？',
      confirmLabel: reset ? '备份并重置' : '备份并恢复', danger: true,
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await flushPendingDrafts();
      await useStore.getState().whenIdle();
      await backupService.create(reset ? 'before-reset' : 'before-import');
      if (reset) await useStore.getState().resetSample();
      else {
        const result = await useStore.getState().importData(payload);
        if (!result.ok) throw new Error(result.error);
      }
      setPreview(null);
      setPayload(null);
      setMessage(reset ? '示例数据已恢复。原数据可从历史备份找回。' : '导入完成。已补齐旧格式字段并验证关联关系。');
      window.dispatchEvent(new Event('workbench:drafts-changed'));
    } catch (error) { setMessage(`操作失败：${String(error)}`); }
    finally { setBusy(false); }
  };

  return <section className="card settings-section">
    <h3>数据导入与导出</h3>
    <p className="desc">桌面版按记录保存到本机 SQLite。JSON 包含正式记录、回收站和最近一年的活动历史；草稿请用下方数据库备份保护。本地附件保存路径引用，不包含文件本体。</p>
    <p className="desc">从旧 Windows 版升级：先在旧版导出 JSON，再在这里选择该文件，核对数量后导入。原版数据不会被自动删除。</p>
    <div className="data-actions">
      {(['json', 'markdown', 'csv', 'html'] as const).map((format) => <button key={format} className="btn btn-ghost" disabled={busy} onClick={() => void onExport(format)}>
        <Download size={15} />{format === 'json' ? 'JSON 备份' : format.toUpperCase()}
      </button>)}
      <button className="btn btn-ghost" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={15} />导入 JSON</button>
      <button className="btn btn-ghost btn-danger" disabled={busy} onClick={() => void replaceData(true)}><RotateCcw size={15} />恢复示例数据</button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void inspect(file);
        event.target.value = '';
      }} />
    </div>
    {preview && <div className="card" style={{ padding: 16, marginTop: 12 }}>
      <strong>导入预览</strong>
      <p>{preview.summary.records} 条记录 · {preview.summary.workspaces} 个工作区 · {preview.summary.types} 个类型 · 回收站 {preview.summary.trashed} 条 · 活动 {preview.summary.activities} 条</p>
      {preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}
      <button className="btn btn-primary" disabled={busy} onClick={() => void replaceData(false)}>确认恢复备份</button>
      <button className="btn btn-ghost" disabled={busy} onClick={() => { setPreview(null); setPayload(null); }}>取消</button>
    </div>}
    {message && <p role="status" style={{ marginTop: 12 }}>{message}</p>}
  </section>;
}
