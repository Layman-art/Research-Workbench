import { Search, Plus } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../stores';
import { requestEditor } from '../editorBus';

export function TopBar() {
  const { search, setSearch, workspaces, workspaceFilter, setWorkspaceFilter, view, types } = useStore(
    useShallow((state) => ({
      search: state.search,
      setSearch: state.setSearch,
      workspaces: state.workspaces,
      workspaceFilter: state.workspaceFilter,
      setWorkspaceFilter: state.setWorkspaceFilter,
      view: state.view,
      types: state.types,
    })),
  );

  const currentType = types.find((t) => t.id === view);

  return (
    <div className="topbar">
      <div className="search-box">
        <Search size={15} color="#a8a294" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索标题、正文、自定义字段…"
        />
      </div>
      <select
        className="workspace-select"
        value={workspaceFilter}
        onChange={(e) => setWorkspaceFilter(e.target.value)}
        aria-label="工作区筛选"
      >
        <option value="all">全部工作区</option>
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      <div className="topbar-spacer" />
      {view !== 'settings' && (
        <button
          className="btn btn-primary"
          onClick={() => requestEditor(currentType ? { typeId: currentType.id } : {})}
        >
          <Plus size={15} />
          {currentType ? `新建${currentType.name}` : '新建记录'}
        </button>
      )}
    </div>
  );
}
