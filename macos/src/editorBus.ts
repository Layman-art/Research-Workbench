export interface EditorRequest {
  recordId?: string;
  typeId?: string;
  /** 新建日程时预填计划日期 */
  planDate?: string;
  /** 新建待办时预关联科研项目 */
  projectId?: string;
}

/** 全局编辑器打开请求（侧边栏 / 各视图触发，App 统一挂载 EditorModal） */
export function requestEditor(detail: EditorRequest) {
  window.dispatchEvent(new CustomEvent<EditorRequest>(EDITOR_EVENT, { detail }));
}

export const EDITOR_EVENT = 'rw:editor';
