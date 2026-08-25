import logo from '../assets/logo.png';

/** 品牌拖拽区；macOS 交通灯由系统标题栏管理。 */
export function TitleBar() {
  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-brand">
        <img className="titlebar-logo" src={logo} alt="" />
        <span className="titlebar-title serif">Research Workbench · 科研工作台</span>
        <span className="titlebar-notes" aria-hidden>
          ♪ 𝄞 ♫
        </span>
      </div>
    </header>
  );
}
