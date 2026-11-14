import { describe, expect, it } from 'vitest';
import { activityReportMarkdown, selectReportActivity } from '../features/reports/activityReport';
import type { ActivityEvent } from '../domain/models';
const event = (id: string, workspaceId: string, day: number, kind: ActivityEvent['kind'] = 'updated'): ActivityEvent => ({ id, workspaceId, recordId: 'r', recordTitle: '笔记 [链接](x)\n新标题', typeId: 'note', kind, occurredAt: new Date(2026, 10, day, 12).getTime() });
describe('real activity reports', () => {
  it('retains separate historical events and scopes inclusive calendar range to workspace', () => {
    const events = [event('old', 'a', 1), event('start', 'a', 2), event('end', 'a', 5, 'completed'), event('other', 'b', 3), event('future', 'a', 6)];
    expect(selectReportActivity(events, '2026-11-02', '2026-11-05', 'a').map((e) => e.id)).toEqual(['end', 'start']);
    expect(selectReportActivity(events, '2026-11-01', '2026-11-06', 'all')).toHaveLength(5);
  });
  it('exports escaped titles and explicitly describes unavailable legacy history', () => {
    const report = activityReportMarkdown([event('e', 'a', 5, 'completed')], '2026-11-01', '2026-11-05', '研究');
    expect(report).toContain('完成 1 项'); expect(report).toContain('## 2026-11-05');
    expect(report).toContain('\\[链接\\]'); expect(report).toContain('不会推算为历史活动');
    expect(activityReportMarkdown([], '2026-11-01', '2026-11-05', '全部')).toContain('暂无已记录活动');
  });
});
