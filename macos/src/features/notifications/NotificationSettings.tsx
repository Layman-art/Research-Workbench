import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../stores';
import { desktopPlatform } from '../../platform';
import type { NotificationPermissionState } from '../../platform/DesktopPlatform';

const LABEL: Record<NotificationPermissionState, string> = {
  prompt: '未请求',
  granted: '已允许',
  denied: '已拒绝',
};

export function NotificationSettings() {
  const { settings, updateSettings } = useStore(
    useShallow((state) => ({ settings: state.settings, updateSettings: state.updateSettings })),
  );
  const [permission, setPermission] = useState<NotificationPermissionState>('prompt');
  useEffect(() => {
    if (desktopPlatform.isDesktop) void desktopPlatform.getNotificationPermission().then(setPermission);
  }, []);
  if (!settings) return null;

  const toggle = async (enabled: boolean) => {
    if (!enabled) {
      await updateSettings({ notificationsEnabled: false });
      return;
    }
    const next = await desktopPlatform.requestNotificationPermission();
    setPermission(next);
    await updateSettings({ notificationsEnabled: next === 'granted' });
  };

  return (
    <div className="card settings-section">
      <h3><Bell size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />原生提醒</h3>
      <p className="desc">到期和过期的未完成待办会弹出 macOS 通知；同一截止日期只提醒一次。权限状态：{LABEL[permission]}。</p>
      <label className="checkline">
        <input type="checkbox" checked={settings.notificationsEnabled && permission === 'granted'} disabled={!desktopPlatform.isDesktop} onChange={(event) => void toggle(event.target.checked)} />
        启用到期提醒
      </label>
      {permission === 'denied' && <p className="settings-hint">请在“系统设置 → 通知 → Research Workbench”中允许通知。</p>}
    </div>
  );
}
