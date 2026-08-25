import { useEffect, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../stores';
import { desktopPlatform } from '../platform';

export function AppStartup({ children }: { children: ReactNode }) {
  const { phase, error, settings, hydrate } = useStore(
    useShallow((state) => ({
      phase: state.phase,
      error: state.error,
      settings: state.settings,
      hydrate: state.hydrate,
    })),
  );

  useEffect(() => {
    void hydrate().catch(() => undefined);
  }, [hydrate]);

  useEffect(() => {
    if (phase === 'ready' && settings && desktopPlatform.isDesktop) {
      void desktopPlatform.setCloseToTray(settings.closeToTray).catch(() => undefined);
    }
  }, [phase, settings]);

  if (phase === 'loading') {
    return (
      <div className="startup-screen" role="status">
        <div className="startup-mark" aria-hidden>♪ 𝄞 ♫</div>
        <h1>正在打开科研工作台…</h1>
        <p>正在读取本机数据</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="startup-screen" role="alert">
        <div className="startup-mark" aria-hidden>𝄢</div>
        <h1>暂时无法打开数据</h1>
        <p>{error ?? '未知错误'}</p>
        <button className="btn btn-primary" onClick={() => void hydrate().catch(() => undefined)}>
          重试
        </button>
        {desktopPlatform.isDesktop && (
          <button className="btn btn-ghost" onClick={() => void desktopPlatform.openDataDirectory()}>
            打开数据目录
          </button>
        )}
      </div>
    );
  }

  return children;
}
