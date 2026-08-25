import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Download, Upload, RotateCcw, Trash2, Plus, Power, Moon } from 'lucide-react';
import { useStore } from '../stores';
import { InlineNotes } from './MusicNotes';
import { desktopPlatform } from '../platform';
import { confirmDialog } from '../confirmBus';
import type { ExportFormat } from '../features/export/exportService';
import { NotificationSettings } from '../features/notifications/NotificationSettings';

function TypeManager() {
  const { types, records, addType, renameType, deleteType } = useStore(
    useShallow((state) => ({
      types: state.types,
      records: state.records,
      addType: state.addType,
      renameType: state.renameType,
      deleteType: state.deleteType,
    })),
  );
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'generic' | 'todo'>('generic');

  return (
    <div className="card settings-section">
      <h3>内容类型</h3>
      <p className="desc">所有类型都可重命名、删除，也可新增自定义类型。删除类型会同时移除其下的全部记录，请谨慎操作。</p>
      {types.map((t) => {
        const count = records.filter((r) => r.typeId === t.id).length;
        return (
          <div className="manage-row" key={t.id}>
            <span className="notes-inline type-note" style={{ letterSpacing: '0.1em' }}>
              {t.note}
            </span>
            <input
              className="form-input"
              defaultValue={t.name}
              key={t.id + t.name}
              onBlur={(e) => e.target.value !== t.name && renameType(t.id, e.target.value)}
            />
            <span className="field-chip">
              {t.kind === 'todo'
                ? '待办'
                : t.kind === 'schedule'
                  ? '日程'
                  : t.kind === 'direction'
                    ? '方向'
                    : t.kind === 'project'
                      ? '项目'
                    : t.id === 'literature'
                        ? '文献'
                      : '通用'}
            </span>
            <span className="field-chip">{count} 条</span>
            <button
              className="icon-btn danger"
              title="删除类型"
              onClick={() => {
                void confirmDialog({
                  message: `删除类型「${t.name}」将同时删除其 ${count} 条记录，确定？`,
                  confirmLabel: '删除',
                  danger: true,
                }).then((confirmed) => {
                  if (confirmed) void deleteType(t.id);
                });
              }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      })}
      <div className="add-row">
        <input
          className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新类型名称，如「专利」「学术兼职」"
        />
        <select
          className="form-select"
          style={{ maxWidth: 120 }}
          value={kind}
          onChange={(e) => setKind(e.target.value as 'generic' | 'todo')}
        >
          <option value="generic">通用</option>
          <option value="todo">待办</option>
        </select>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            addType(name, kind);
            setName('');
          }}
        >
          <Plus size={14} />
          添加
        </button>
      </div>
    </div>
  );
}

function WorkspaceManager() {
  const { workspaces, records, addWorkspace, renameWorkspace, deleteWorkspace } = useStore(
    useShallow((state) => ({
      workspaces: state.workspaces,
      records: state.records,
      addWorkspace: state.addWorkspace,
      renameWorkspace: state.renameWorkspace,
      deleteWorkspace: state.deleteWorkspace,
    })),
  );
  const [name, setName] = useState('');

  return (
    <div className="card settings-section">
      <h3>工作区</h3>
      <p className="desc">工作区用于分隔不同环境（如「课题组」「个人」）。删除工作区后，其记录会移入默认工作区。</p>
      {workspaces.map((w) => (
        <div className="manage-row" key={w.id}>
          <input
            className="form-input"
            defaultValue={w.name}
            key={w.id + w.name}
            onBlur={(e) => e.target.value !== w.name && renameWorkspace(w.id, e.target.value)}
          />
          <span className="field-chip">{records.filter((r) => r.workspaceId === w.id).length} 条</span>
          {w.builtin ? (
            <span className="field-chip">内置</span>
          ) : (
            <button
              className="icon-btn danger"
              title="删除工作区"
              onClick={() => {
                void confirmDialog({
                  message: `确定删除工作区「${w.name}」？`,
                  confirmLabel: '删除',
                  danger: true,
                }).then((confirmed) => {
                  if (confirmed) void deleteWorkspace(w.id);
                });
              }}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ))}
      <div className="add-row">
        <input
          className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新工作区名称"
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            addWorkspace(name);
            setName('');
          }}
        >
          <Plus size={14} />
          添加
        </button>
      </div>
    </div>
  );
}

function DataManager() {
  const { records, types, workspaces, settings, importData, resetSample } = useStore(
    useShallow((state) => ({
      records: state.records,
      types: state.types,
      workspaces: state.workspaces,
      settings: state.settings,
      importData: state.importData,
      resetSample: state.resetSample,
    })),
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

  const onExport = async (format: ExportFormat) => {
    if (!settings) return;
    try {
      const { exportSnapshot } = await import('../features/export/exportService');
      const result = await exportSnapshot(format, { records, types, workspaces, settings }, desktopPlatform);
      if (result.status === 'saved') setMessage(`已保存：${result.filename}`);
    } catch (error) {
      setMessage(`导出失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const onImport = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setMessage('导入失败：备份文件不能超过 10 MB。');
      return;
    }
    try {
      const text = await file.text();
      const result = await importData(JSON.parse(text));
      setMessage(result.ok ? '导入成功，数据已恢复。' : `导入失败：${result.error}`);
    } catch {
      setMessage('导入失败：文件不是有效的 JSON。');
    }
  };

  return (
    <div className="card settings-section">
      <h3>数据管理</h3>
      <p className="desc">全部数据保存在本机 SQLite 数据库中，无需账号与网络。JSON 可用于完整备份，其余格式便于长期阅读和迁移。</p>
      <div className="data-actions">
        <button className="btn btn-ghost" onClick={() => void onExport('json')}>
          <Download size={15} />
          JSON 备份
        </button>
        <button className="btn btn-ghost" onClick={() => void onExport('markdown')}>
          <Download size={15} />
          Markdown
        </button>
        <button className="btn btn-ghost" onClick={() => void onExport('csv')}>
          <Download size={15} />
          CSV
        </button>
        <button className="btn btn-ghost" onClick={() => void onExport('html')}>
          <Download size={15} />
          HTML
        </button>
        <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
          <Upload size={15} />
          导入 JSON
        </button>
        <button
          className="btn btn-ghost btn-danger"
          onClick={() => {
            void confirmDialog({
              message: '将清空当前全部数据并恢复示例数据，确定？',
              confirmLabel: '恢复',
              danger: true,
            }).then((confirmed) => {
              if (confirmed) void resetSample();
            });
          }}
        >
          <RotateCcw size={15} />
          恢复示例数据
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = '';
          }}
        />
      </div>
      {message && <p style={{ marginTop: 12, fontSize: 12.5, color: 'var(--muted)' }}>{message}</p>}
    </div>
  );
}

function ProfileManager() {
  const { displayName, setDisplayName } = useStore(
    useShallow((state) => ({
      displayName: state.displayName,
      setDisplayName: state.setDisplayName,
    })),
  );

  return (
    <div className="card settings-section">
      <h3>个性化</h3>
      <p className="desc">总览页问候语中的显示名，留空则只显示问候。</p>
      <input
        className="form-input"
        defaultValue={displayName}
        key={displayName}
        onBlur={(e) => e.target.value.trim() !== displayName && setDisplayName(e.target.value)}
        placeholder="输入显示名"
      />
    </div>
  );
}

function AppearanceManager() {
  const { settings, updateSettings } = useStore(
    useShallow((state) => ({
      settings: state.settings,
      updateSettings: state.updateSettings,
    })),
  );
  if (!settings) return null;

  return (
    <div className="card settings-section">
      <h3>
        <Moon size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />
        外观与动效
      </h3>
      <p className="desc">月夜模式采用低对比墨黑背景；减少动效会停止持续漂浮的音符和非必要过渡。</p>
      <div className="form-row">
        <div>
          <label className="form-label" htmlFor="theme-mode">主题</label>
          <select
            id="theme-mode"
            className="form-select"
            value={settings.theme}
            onChange={(event) => void updateSettings({ theme: event.target.value as typeof settings.theme })}
          >
            <option value="system">跟随系统</option>
            <option value="light">纸墨浅色</option>
            <option value="dark">月夜深色</option>
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="motion-mode">动效</label>
          <select
            id="motion-mode"
            className="form-select"
            value={settings.motion}
            onChange={(event) => void updateSettings({ motion: event.target.value as typeof settings.motion })}
          >
            <option value="system">跟随系统</option>
            <option value="full">完整动效</option>
            <option value="reduce">减少动效</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function LaunchManager() {
  const supported = desktopPlatform.isDesktop;
  const { settings, updateSettings } = useStore(
    useShallow((state) => ({
      settings: state.settings,
      updateSettings: state.updateSettings,
    })),
  );

  const toggle = async (enabled: boolean) => {
    if (!supported) return;
    try {
      await updateSettings({ autoLaunch: await desktopPlatform.setAutoLaunch(enabled) });
    } catch { /* 状态层保留上次已持久化的值 */ }
  };

  const toggleTray = async (enabled: boolean) => {
    if (!supported) return;
    try {
      await updateSettings({ closeToTray: await desktopPlatform.setCloseToTray(enabled) });
    } catch { /* 状态层保留上次已持久化的值 */ }
  };

  return (
    <div className="card settings-section">
      <h3>
        <Power size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />
        启动
      </h3>
      <p className="desc">自启与后台运行设置（仅桌面安装版生效）。后台运行时，窗口关闭后会驻留托盘，右键托盘图标可退出。</p>
      <label className="checkline">
        <input
          type="checkbox"
          checked={settings?.autoLaunch ?? false}
          disabled={!supported}
          onChange={(e) => toggle(e.target.checked)}
        />
        开机自动启动
        {!supported && <span className="field-chip">浏览器预览中不可用</span>}
      </label>
      <label className="checkline">
        <input
          type="checkbox"
          checked={settings?.closeToTray ?? false}
          disabled={!supported}
          onChange={(e) => toggleTray(e.target.checked)}
        />
        关闭窗口时后台运行（最小化到托盘）
      </label>
    </div>
  );
}

export function SettingsView() {
  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">
          设置与数据 <InlineNotes text="♪" />
        </h1>
      </div>
      <div className="settings-grid">
        <TypeManager />
        <WorkspaceManager />
        <AppearanceManager />
        <NotificationSettings />
        <DataManager />
        <LaunchManager />
        <ProfileManager />
        <div className="card settings-section">
          <h3>关于</h3>
          <p className="desc" style={{ marginBottom: 0 }}>
            Research Workbench · 科研工作台 · Release 版 —— 本地优先，数据完全属于你自己。
          </p>
          <div className="about-notes">♪ 𝄞 ♫ ♩ 𝅘𝅥 ♬</div>
        </div>
      </div>
    </div>
  );
}
