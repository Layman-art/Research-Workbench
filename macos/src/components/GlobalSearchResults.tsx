import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../stores';
import { typeIcon } from '../icons';
import { requestEditor } from '../editorBus';
import { markdownSummary } from '../features/markdown/plainText';
import { STATUS_LABEL } from '../types';
import type { RecordItem } from '../types';

/** 跨全部内容类型的全局搜索结果（标题 / 正文 / 自定义字段） */
export function GlobalSearchResults() {
  const { records, types, workspaces, workspaceFilter, search, statusFilter } = useStore(
    useShallow((state) => ({
      records: state.records,
      types: state.types,
      workspaces: state.workspaces,
      workspaceFilter: state.workspaceFilter,
      search: state.search,
      statusFilter: state.statusFilter,
    })),
  );

  const normalizedQuery = search.trim().toLowerCase();
  const typeNames = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const workspaceNames = useMemo(() => new Map(workspaces.map((w) => [w.id, w.name])), [workspaces]);

  const groups = useMemo(() => {
    if (!normalizedQuery) return [];
    const matches = records
      .filter((record) => {
        if (workspaceFilter !== 'all' && record.workspaceId !== workspaceFilter) return false;
        if (statusFilter === 'archived' && !record.archived) return false;
        if (statusFilter !== 'all' && statusFilter !== 'archived' && (record.archived || record.status !== statusFilter)) return false;
        if (statusFilter !== 'archived' && record.archived) return false;
        const searchableText = [
          record.title,
          record.content,
          ...record.fields.map((field) => `${field.name} ${field.value}`),
        ]
          .join('\n')
          .toLowerCase();
        return searchableText.includes(normalizedQuery);
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const map = new Map<string, RecordItem[]>();
    for (const record of matches) {
      const key = record.typeId;
      const list = map.get(key);
      if (list) list.push(record);
      else map.set(key, [record]);
    }
    return [...map.entries()];
  }, [normalizedQuery, records, statusFilter, workspaceFilter]);

  const total = groups.reduce((sum, [, items]) => sum + items.length, 0);

  return (
    <div className="global-search">
      <div className="page-head">
        <h1 className="page-title">搜索结果</h1>
        <p className="page-desc">
          {normalizedQuery ? (
            <>在全部内容类型中匹配「{search.trim()}」，共 {total} 条结果。</>
          ) : (
            '输入关键词以搜索全部记录。'
          )}
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="empty">
          <div className="notes">♪ ♫ ♩</div>
          <div className="serif">没有找到匹配的记录</div>
          <div>换个关键词，或调整工作区与状态筛选试试。</div>
        </div>
      ) : (
        groups.map(([typeId, items]) => {
          const type = typeNames.get(typeId);
          const Icon = type ? typeIcon(type.icon) : null;
          return (
            <section key={typeId} className="search-group">
              <div className="section-title">
                {Icon && <Icon size={17} />}
                {type?.name ?? typeId}
                <span className="search-group-count">{items.length}</span>
              </div>
              <div className="record-list">
                {items.map((record) => {
                  const summary = markdownSummary(record.content, 140);
                  const ws = workspaceNames.get(record.workspaceId);
                  return (
                    <button
                      key={record.id}
                      className="card record-row search-row"
                      onClick={() => requestEditor({ recordId: record.id })}
                    >
                      <div className="record-main">
                        <div className="record-title">{record.title}</div>
                        {summary && <div className="record-snippet">{summary}</div>}
                        <div className="record-meta">
                          {ws && <span className="field-chip">{ws}</span>}
                          <span className="field-chip">
                            {record.archived ? '已归档' : STATUS_LABEL[record.status]}
                          </span>
                        </div>
                      </div>
                      <span className="search-row-arrow">→</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
