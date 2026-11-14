import { useState } from 'react';
import { desktopPlatform } from '../platform';
import packageInfo from '../../package.json';

const releasePage = 'https://github.com/Layman-art/Research-Workbench/releases/latest';

export function AboutPanel() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const check = async () => {
    setBusy(true);
    try {
      const response = await fetch('https://api.github.com/repos/Layman-art/Research-Workbench/releases/latest', { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || !('tag_name' in data) || typeof data.tag_name !== 'string') throw new Error('发布信息格式无效');
      const latest = data.tag_name.replace(/^v/, '');
      const parts = /^\d+\.\d+\.\d+$/.test(latest) ? latest.split('.').map(Number) : null;
      const current = packageInfo.version.split('.').map(Number);
      const comparison = parts?.findIndex((part, i) => part !== current[i]) ?? -1;
      setMessage(parts && comparison >= 0 && parts[comparison] > current[comparison]
        ? `发现新版本 v${latest}，请打开发布页下载安装。`
        : parts ? '当前已是最新稳定版。' : '请在发布页查看最新版本。');
    } catch (error) { setMessage(`暂时无法检查更新：${String(error)}。可直接打开发布页。`); }
    finally { setBusy(false); }
  };
  return <section className="card settings-section">
    <h3>关于 Research Workbench</h3>
    <p>科研工作台 v{packageInfo.version} · 本地优先</p>
    <p className="desc">Ctrl / ⌘ + N 新建 · Ctrl / ⌘ + K 搜索 · Ctrl / ⌘ + S 保存。自动备份保留 30 份，回收站保留 30 天，活动历史保留 366 天。</p>
    <div className="data-actions">
      <button className="btn btn-ghost" disabled={busy} onClick={() => void check()}>检查更新</button>
      <button className="btn btn-ghost" onClick={() => void desktopPlatform.openExternal(releasePage)}>打开发布页</button>
    </div>
    {message && <p role="status">{message}</p>}
  </section>;
}
