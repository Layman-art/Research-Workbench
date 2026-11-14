import type { ActivityEvent } from '../../domain/models';
import { formatDate } from '../../utils';

const LABELS: Record<ActivityEvent['kind'], string> = { created: '新建', updated: '更新', completed: '完成', deleted: '移入回收站', restored: '恢复' };
const escape = (text: string) => text.replace(/[\\`*_{}[\]<>#|]/g, '\\$&').replace(/\r?\n/g, ' ');

export function selectReportActivity(events: ActivityEvent[], start: string, end: string, workspace: string): ActivityEvent[] {
  return events.filter((event) => {
    const date = formatDate(event.occurredAt);
    return date >= start && date <= end && (workspace === 'all' || event.workspaceId === workspace);
  }).sort((a, b) => b.occurredAt - a.occurredAt);
}

export function activityReportMarkdown(events: ActivityEvent[], start: string, end: string, workspaceName: string): string {
  const lines = [`# 科研工作回顾`, '', `时间：${start} 至 ${end}`, '', `工作区：${escape(workspaceName)}`, '', `共 ${events.length} 次活动，完成 ${events.filter((event) => event.kind === 'completed').length} 项待办。`, '', '> 仅包含本版本开始记录的真实活动；旧记录的最后修改时间不会推算为历史活动。', ''];
  let previous = '';
  for (const event of events) {
    const date = formatDate(event.occurredAt);
    if (date !== previous) { lines.push(`## ${date}`, ''); previous = date; }
    const time = new Date(event.occurredAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    lines.push(`- ${time} · ${LABELS[event.kind]}：${escape(event.recordTitle)}`);
  }
  if (!events.length) lines.push('本时间段暂无已记录活动。');
  return lines.join('\n') + '\n';
}
