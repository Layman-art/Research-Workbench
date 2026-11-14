import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../stores';
import { useToday } from '../hooks/useToday';
import { formatDate } from '../utils';
import { desktopPlatform } from '../platform';
import { activityReportMarkdown, selectReportActivity } from '../features/reports/activityReport';
import './workflow.css';

function rangeFor(today: string, kind: 'week' | 'month') {
  const [y, m, d] = today.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(kind === 'month' ? 1 : d - (date.getDay() + 6) % 7);
  return { start: formatDate(date.getTime()), end: today };
}

export function ReportsView() {
  const { activities, workspaceFilter, workspaces } = useStore(useShallow((s) => ({ activities: s.activities, workspaceFilter: s.workspaceFilter, workspaces: s.workspaces })));
  const today = useToday();
  const [period, setPeriod] = useState<'week' | 'month' | 'custom'>('week');
  const [custom, setCustom] = useState(() => rangeFor(today, 'week'));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const { start, end } = period === 'custom' ? custom : rangeFor(today, period);
  const valid = !!start && !!end && start <= end;
  const events = useMemo(() => valid ? selectReportActivity(activities, start, end, workspaceFilter) : [], [activities, start, end, workspaceFilter, valid]);
  const workspace = workspaces.find((w) => w.id === workspaceFilter)?.name ?? '全部工作区';
  const content = useMemo(() => activityReportMarkdown(events, start, end, workspace), [events, start, end, workspace]);
  const save = async () => {
    setBusy(true); setMessage('');
    try {
      const file = await desktopPlatform.saveTextFile({ suggestedName: `科研工作回顾_${start}_${end}.md`, contents: content, mimeType: 'text/markdown' });
      setMessage(file ? '工作回顾已导出。' : '已取消导出。');
    } catch (error) { setMessage(`导出失败：${error instanceof Error ? error.message : String(error)}`); }
    finally { setBusy(false); }
  };
  return <div>
    <div className="page-head"><h1 className="page-title">工作回顾</h1><p className="page-desc">按真实完成与编辑活动生成周报、月报。旧数据不会被虚构为历史活动。</p></div>
    <div className="workflow-actions">
      <button className="btn btn-ghost" aria-pressed={period === 'week'} onClick={() => setPeriod('week')}>本周</button>
      <button className="btn btn-ghost" aria-pressed={period === 'month'} onClick={() => setPeriod('month')}>本月</button>
      <label>开始日期<input type="date" value={start} onChange={(e) => { setCustom({ start: e.target.value, end }); setPeriod('custom'); }} /></label>
      <label>结束日期<input type="date" value={end} onChange={(e) => { setCustom({ start, end: e.target.value }); setPeriod('custom'); }} /></label>
      <button className="btn btn-primary" disabled={!valid || busy} onClick={() => void save()}>导出 Markdown</button>
    </div>
    {!valid && <p role="alert">请选择有效的日期范围，结束日期不能早于开始日期。</p>}
    {message && <p role="status">{message}</p>}
    <pre className="card report-preview">{content}</pre>
  </div>;
}
