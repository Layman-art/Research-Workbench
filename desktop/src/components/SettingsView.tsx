import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Trash2, Plus, Power, Moon } from 'lucide-react';
import { useStore } from '../stores';
import { InlineNotes } from './MusicNotes';
import { desktopPlatform } from '../platform';
import { confirmDialog } from '../confirmBus';
import { NotificationSettings } from '../features/notifications/NotificationSettings';
import { DataManager } from '../features/backups/DataManager';
import { BackupPanel } from '../features/backups/BackupPanel';
import { AboutPanel } from './AboutPanel';
import type { TypeKind } from '../domain/models';

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
  const [kind, setKind] = useState<TypeKind>('generic');

  return (
    <div className="card settings-section">
      <h3>内容类型</h3>
      <p className="desc">可重命名或添加类型。内置类型保留；自定义类型需移走其记录（包括回收站中的记录）后才能删除。</p>
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
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur(); }}
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
              disabled={t.builtin || count > 0}
              onClick={() => {
                void confirmDialog({
                  message: `删除空类型「${t.name}」，确定？`,
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
          onChange={(e) => setKind(e.target.value as TypeKind)}
        >
          <option value="generic">通用</option>
          <option value="todo">待办</option>
          <option value="schedule">日程</option>
          <option value="direction">方向</option>
          <option value="project">项目</option>
        </select>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            void addType(name, kind).then(() => setName(''));
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
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur(); }}
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
            void addWorkspace(name).then(() => setName(''));
          }}
        >
          <Plus size={14} />
          添加
        </button>
      </div>
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
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur(); }}
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
    } catch (error) { useStore.setState({ error: `自启设置失败：${String(error)}` }); }
  };

  const toggleTray = async (enabled: boolean) => {
    if (!supported) return;
    try {
      await updateSettings({ closeToTray: await desktopPlatform.setCloseToTray(enabled) });
    } catch (error) { useStore.setState({ error: `后台运行设置失败：${String(error)}` }); }
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
        开机自动启动（安静驻留托盘）
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
        <BackupPanel />
        <LaunchManager />
        <ProfileManager />
        <AboutPanel />
      </div>
    </div>
  );
}
