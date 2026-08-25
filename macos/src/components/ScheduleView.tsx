import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  CalendarDays,
  ArrowRight,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useStore } from '../stores';
import { filterRecords } from '../store/selectors';
import type { RecordItem } from '../types';
import { InlineNotes } from './MusicNotes';
import { Modal } from './Modal';
import { requestEditor } from '../editorBus';
import { confirmDialog } from '../confirmBus';
import { planColor, planTimeText, sortPlans } from '../planUtils';
import { formatDate, todayStr } from '../utils';
import { markdownSummary } from '../features/markdown/plainText';
import clsx from 'clsx';

const DAY = 86400000;
const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const CN_WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
type ScheduleMode = 'week-grid' | 'week-list' | 'month';
type ScheduleRange = 'recent' | 'past' | 'all';

const RANGE_LABELS: Array<{ value: ScheduleRange; label: string }> = [
  { value: 'recent', label: '近期' },
  { value: 'past', label: '历史' },
  { value: 'all', label: '全部' },
];

function localDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function shiftDate(dateStr: string, days: number): string {
  const date = localDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date.getTime());
}

function shiftMonth(dateStr: string, delta: number): string {
  const date = localDate(dateStr);
  date.setDate(1);
  date.setMonth(date.getMonth() + delta);
  return formatDate(date.getTime());
}

/** 「8 月 18 日 · 周二」 */
function agendaDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return `${m} 月 ${d} 日 · ${CN_WEEK[wd]}`;
}

/** 「2026-08」→「2026 年 8 月」 */
function monthLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  return `${y} 年 ${m} 月`;
}

/** 单个日程块：左色条 + 时间 + 事件（周视图与后续清单共用） */
function PlanChip({ record }: { record: RecordItem }) {
  const color = planColor(record.id);
  const open = () => requestEditor({ recordId: record.id });
  return (
    <div
      className="plan-chip"
      style={{ borderLeftColor: color }}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
      role="button"
      tabIndex={0}
      title={record.title}
    >
      <span className="t" style={{ color }}>
        {planTimeText(record)}
      </span>
      <span className="plan-chip-title">{record.title}</span>
    </div>
  );
}

function SchedulePreview({ records, typeId, onOpen }: { records: RecordItem[]; typeId: string; onOpen: () => void }) {
  const today = todayStr();
  const upcoming = records
    .filter((record) => record.planDate && record.planDate >= today)
    .sort((a, b) => `${a.planDate ?? ''} ${a.planStart ?? ''}`.localeCompare(`${b.planDate ?? ''} ${b.planStart ?? ''}`))
    .slice(0, 5);

  return (
    <section className="schedule-preview">
      <div className="schedule-preview-head">
        <div>
          <h2 className="section-title">近期日程 <InlineNotes text="𝅝" /></h2>
          <p>今天与接下来的安排</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onOpen}>
          进入日程管理
          <ArrowRight size={14} />
        </button>
      </div>
      {upcoming.length === 0 ? (
        <button className="schedule-preview-empty" onClick={() => requestEditor({ typeId, planDate: today })}>
          <Plus size={15} /> 今天之后暂无安排，添加第一条日程
        </button>
      ) : (
        <div className="schedule-preview-list">
          {upcoming.map((record) => (
            <button key={record.id} className="schedule-preview-item" onClick={() => requestEditor({ recordId: record.id })}>
              <span className="schedule-preview-date">
                {record.planDate === today ? '今天' : record.planDate?.slice(5).replace('-', '/')}
              </span>
              <span className="schedule-preview-time" style={{ color: planColor(record.id) }}>{planTimeText(record)}</span>
              <span className="schedule-preview-title">{record.title}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function ScheduleView({ typeId, embedded }: { typeId: string; embedded?: boolean }) {
  const { records, types, workspaceFilter, search, statusFilter, setView, deleteRecord } = useStore(
    useShallow((state) => ({
      records: state.records,
      types: state.types,
      workspaceFilter: state.workspaceFilter,
      search: state.search,
      statusFilter: state.statusFilter,
      setView: state.setView,
      deleteRecord: state.deleteRecord,
    })),
  );
  const [anchorDate, setAnchorDate] = useState(todayStr);
  const [mode, setMode] = useState<ScheduleMode>('week-grid');
  const [range, setRange] = useState<ScheduleRange>('recent');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => new Set([todayStr().slice(0, 7)]));
  const [dayDrawer, setDayDrawer] = useState<string | null>(null);
  const type = types.find((t) => t.id === typeId);
  const all = useMemo(
    () =>
      filterRecords({
        records,
        typeId,
        workspaceId: workspaceFilter,
        status: statusFilter,
        query: search,
      }),
    [records, search, statusFilter, typeId, workspaceFilter],
  );

  // 以周一为一周起点
  const days = useMemo(() => {
    const anchor = localDate(anchorDate);
    const start = anchor.getTime() - ((anchor.getDay() + 6) % 7) * DAY;
    return Array.from({ length: 7 }, (_, i) => {
      const ts = start + i * DAY;
      return { ts, str: formatDate(ts), label: WEEK_LABELS[i] };
    });
  }, [anchorDate]);

  // 所有日程按日期映射（周视图与月历共用）
  const byDate = useMemo(() => {
    const map = new Map<string, RecordItem[]>();
    for (const r of all) {
      if (r.planDate) {
        const arr = map.get(r.planDate) ?? [];
        arr.push(r);
        map.set(r.planDate, arr);
      }
    }
    for (const [date, items] of map) map.set(date, sortPlans(items));
    return map;
  }, [all]);

  // 月历格子：周一为列起点，前后补邻月浅色日期
  const monthCells = useMemo(() => {
    const anchor = localDate(anchorDate);
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const total = Math.ceil((offset + daysInMonth) / 7) * 7;
    const cells: Array<{ date: string; inMonth: boolean }> = [];
    for (let i = 0; i < total; i++) {
      const d = new Date(year, month, 1 - offset + i);
      cells.push({ date: formatDate(d.getTime()), inMonth: d.getMonth() === month });
    }
    return cells;
  }, [anchorDate]);

  // 议程：按范围过滤，再按日期分组，最后按月份聚合（仅「全部」需要月份折叠）
  const managedMonths = useMemo(() => {
    const today = todayStr();
    const recentEnd = shiftDate(today, 14);
    const filtered = all.filter((record) => {
      if (range === 'all') return true;
      if (!record.planDate) return false;
      if (range === 'recent') return record.planDate >= today && record.planDate <= recentEnd;
      return record.planDate < today;
    });
    filtered.sort((a, b) => {
      const result = `${a.planDate ?? '9999'} ${a.planStart ?? ''}`.localeCompare(`${b.planDate ?? '9999'} ${b.planStart ?? ''}`);
      return range === 'past' ? -result : result;
    });
    const dayGroups: Array<{ date: string; items: RecordItem[] }> = [];
    for (const record of filtered) {
      const date = record.planDate ?? '';
      const last = dayGroups[dayGroups.length - 1];
      if (last?.date === date) last.items.push(record);
      else dayGroups.push({ date, items: [record] });
    }
    if (range !== 'all') {
      return dayGroups.map((day) => ({ month: day.date, label: day.date ? agendaDayLabel(day.date) : '未指定日期', days: [day] }));
    }
    const months: Array<{ month: string; label: string; days: Array<{ date: string; items: RecordItem[] }> }> = [];
    for (const day of dayGroups) {
      const month = day.date ? day.date.slice(0, 7) : '';
      const last = months[months.length - 1];
      if (last?.month === month) last.days.push(day);
      else months.push({ month, label: month ? monthLabel(month) : '未指定日期', days: [day] });
    }
    return months;
  }, [all, range]);

  if (!type) return null;

  if (embedded) {
    return <SchedulePreview records={all} typeId={typeId} onOpen={() => setView(typeId)} />;
  }

  const today = todayStr();
  const isMonth = mode === 'month';
  const monthTitle = (() => {
    const a = localDate(anchorDate);
    return `${a.getFullYear()} 年 ${a.getMonth() + 1} 月`;
  })();
  const currentMonthTitle = `${new Date().getFullYear()} 年 ${new Date().getMonth() + 1} 月`;
  const rangeLabel = `${days[0].str.slice(5).replace('-', '/')} – ${days[6].str.slice(5).replace('-', '/')}`;
  const onPrev = () => (isMonth ? setAnchorDate((d) => shiftMonth(d, -1)) : setAnchorDate((d) => shiftDate(d, -7)));
  const onNext = () => (isMonth ? setAnchorDate((d) => shiftMonth(d, 1)) : setAnchorDate((d) => shiftDate(d, 7)));

  return (
    <div className="schedule-view">
      <div className="page-head schedule-page-head">
        <div>
          <h1 className="page-title">
            {type.name} <InlineNotes text={type.note} />
          </h1>
          <p className="page-desc">用周历和月历安排时间，议程默认聚焦近期。</p>
        </div>
        <button className="btn btn-primary" onClick={() => requestEditor({ typeId, planDate: todayStr() })}>
          <Plus size={15} /> 新建日程
        </button>
      </div>

      <div className="week-toolbar">
        <button className="btn btn-ghost btn-sm" onClick={onPrev}>
          <ChevronLeft size={14} />
          {isMonth ? '上一月' : '上一周'}
        </button>
        <div className="week-toolbar-center">
          <div className="week-range serif">
            {isMonth ? monthTitle : rangeLabel}
            {((isMonth && monthTitle !== currentMonthTitle) || (!isMonth && !days.some((day) => day.str === today))) && (
              <button className="week-today-btn" onClick={() => setAnchorDate(today)}>回到今天</button>
            )}
          </div>
          <div className="schedule-mode-switch" role="group" aria-label="日程显示方式">
            <button className={clsx(mode === 'week-grid' && 'active')} aria-pressed={mode === 'week-grid'} onClick={() => setMode('week-grid')}>
              <LayoutGrid size={13} />
              周网格
            </button>
            <button className={clsx(mode === 'week-list' && 'active')} aria-pressed={mode === 'week-list'} onClick={() => setMode('week-list')}>
              <List size={13} />
              周清单
            </button>
            <button className={clsx(mode === 'month' && 'active')} aria-pressed={mode === 'month'} onClick={() => setMode('month')}>
              <CalendarDays size={13} />
              月历
            </button>
          </div>
        </div>
        <div className="week-toolbar-end">
          <label className="schedule-date-jump">
            <span>跳转</span>
            <input type="date" aria-label="跳转到日期" value={anchorDate} onChange={(event) => setAnchorDate(event.target.value || todayStr())} />
          </label>
          <button className="btn btn-ghost btn-sm" onClick={onNext}>
            {isMonth ? '下一月' : '下一周'}
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="schedule-body">
        {mode === 'week-grid' ? (
          <div className="week-grid-scroll">
            <div className="week-grid">
              {days.map((d) => {
                const items = byDate.get(d.str) ?? [];
                const isToday = d.str === today;
                return (
                  <div key={d.str} className={clsx('day-col', isToday && 'today')}>
                    <div className="day-head">
                      <span className="day-label">{d.label}</span>
                      <span className={clsx('day-date', isToday && 'on')}>
                        {Number(d.str.slice(8))}
                      </span>
                    </div>
                    <div className="day-items">
                      {items.map((record) => (
                        <PlanChip key={record.id} record={record} />
                      ))}
                    </div>
                    <button
                      className="day-add"
                      aria-label={`在${agendaDayLabel(d.str)}安排日程`}
                      onClick={() => requestEditor({ typeId, planDate: d.str })}
                    >
                      <Plus size={13} />
                      安排
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : mode === 'week-list' ? (
          <div className="week-list">
            {days.map((day) => {
              const items = byDate.get(day.str) ?? [];
              const isToday = day.str === today;
              return (
                <section key={day.str} className={clsx('week-list-day', isToday && 'today')}>
                  <div className="week-list-date">
                    <span>{day.label}</span>
                    <strong>{Number(day.str.slice(5, 7))} 月 {Number(day.str.slice(8))} 日</strong>
                    {isToday && <em>今天</em>}
                  </div>
                  <div className="week-list-items">
                    {items.length > 0 ? (
                      items.map((record) => <PlanChip key={record.id} record={record} />)
                    ) : (
                      <span className="week-list-empty">暂无安排</span>
                    )}
                  </div>
                  <button
                    className="week-list-add"
                    aria-label={`在${agendaDayLabel(day.str)}安排日程`}
                    onClick={() => requestEditor({ typeId, planDate: day.str })}
                  >
                    <Plus size={14} />
                    安排
                  </button>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="month-grid-scroll">
            <div className="month-grid">
              {WEEK_LABELS.map((label) => (
                <div key={label} className="month-weekday">{label}</div>
              ))}
              {monthCells.map((cell) => {
                const items = byDate.get(cell.date) ?? [];
                const isToday = cell.date === today;
                const openDay = () => setDayDrawer(cell.date);
                return (
                  <div key={cell.date} className={clsx('month-cell', isToday && 'today', !cell.inMonth && 'outside')} role="button" tabIndex={0}
                    onClick={openDay}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDay(); } }}>
                    <span className={clsx('month-cell-date', isToday && 'on')}>{Number(cell.date.slice(8))}</span>
                    <div className="month-cell-events" onClick={(event) => event.stopPropagation()}>
                      {items.slice(0, 3).map((record) => <PlanChip key={record.id} record={record} />)}
                    </div>
                    {items.length > 3 && <span className="month-cell-more">+{items.length - 3} 更多</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <section className="schedule-manager">
        <div className="schedule-manager-head">
          <div>
            <h2 className="serif">议程</h2>
            <p>{range === 'all' ? '全部日程按月份折叠，点月份展开或收起。' : range === 'past' ? '过去落笔的安排。' : '今天起未来两周的安排。'}</p>
          </div>
          <div className="schedule-range-switch" role="group" aria-label="日程范围">
            {RANGE_LABELS.map((item) => (
              <button
                key={item.value}
                className={clsx(range === item.value && 'active')}
                aria-pressed={range === item.value}
                onClick={() => setRange(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="schedule-manager-list">
          {managedMonths.length === 0 ? (
            <div className="schedule-manager-empty">
              此范围内暂无日程
              <span>可以在上方周视图中选择日期，或新建一条安排。</span>
            </div>
          ) : (
            managedMonths.map((monthGroup) => {
              // 只有「全部」范围才折叠；近期/历史直接全部展开（当前月也能点折叠）
              const isExpanded = range !== 'all' || expandedMonths.has(monthGroup.month);
              const toggleMonth = () => {
                setExpandedMonths((prev) => {
                  const next = new Set(prev);
                  if (next.has(monthGroup.month)) next.delete(monthGroup.month);
                  else next.add(monthGroup.month);
                  return next;
                });
              };
              return (
                <section key={monthGroup.month || 'undated'} className="schedule-manager-month">
                  {range === 'all' ? (
                    <button
                      className="schedule-month-divider"
                      onClick={toggleMonth}
                      aria-expanded={isExpanded}
                    >
                      <span className="schedule-month-chev">{isExpanded ? '▾' : '▸'}</span>
                      <span className="schedule-month-label">{monthGroup.label}</span>
                      <span className="schedule-month-count">
                        {monthGroup.days.reduce((sum, day) => sum + day.items.length, 0)} 项
                      </span>
                    </button>
                  ) : (
                    <div className="schedule-day-heading">{monthGroup.label}</div>
                  )}
                  {isExpanded && monthGroup.days.map((group) => (
                    <div key={group.date || 'undated'} className="schedule-manager-day">
                <header>
                  <strong>{group.date ? agendaDayLabel(group.date) : '未指定日期'}</strong>
                  <span>{group.items.length} 项</span>
                </header>
                <div className="schedule-manager-items">
                  {group.items.map((record) => {
                    const summary = markdownSummary(record.content, 110);
                    return (
                      <article
                        key={record.id}
                        className="schedule-manager-item"
                        style={{ borderLeftColor: planColor(record.id) }}
                      >
                        <span className="schedule-manager-time" style={{ color: planColor(record.id) }}>
                          {planTimeText(record)}
                        </span>
                        <button
                          className="schedule-manager-content"
                          onClick={() => requestEditor({ recordId: record.id })}
                          title={`编辑 ${record.title}`}
                        >
                          <strong>{record.title}</strong>
                          {summary && <span>{summary}</span>}
                        </button>
                        <div className="schedule-manager-actions">
                          <button
                            className="icon-btn"
                            aria-label={`编辑 ${record.title}`}
                            title="编辑"
                            onClick={() => requestEditor({ recordId: record.id })}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="icon-btn danger"
                            aria-label={`删除 ${record.title}`}
                            title="删除"
                            onClick={() => {
                              void confirmDialog({
                                message: `确定删除日程「${record.title}」吗？`,
                                confirmLabel: '删除',
                                danger: true,
                              }).then((confirmed) => {
                                if (confirmed) void deleteRecord(record.id);
                              });
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
                    </div>
                  ))}
                </section>
              );
            })
          )}
        </div>
      </section>

      {dayDrawer && (
        <Modal
          title={agendaDayLabel(dayDrawer)}
          onClose={() => setDayDrawer(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => { setAnchorDate(dayDrawer); setMode('week-grid'); setDayDrawer(null); }}>在周网格中打开</button>
              <button className="btn btn-primary" onClick={() => { requestEditor({ typeId, planDate: dayDrawer }); setDayDrawer(null); }}>安排</button>
            </>
          }
        >
          <div className="day-drawer-list">
            {(byDate.get(dayDrawer) ?? []).length === 0 ? (
              <p className="week-list-empty">这一天还没有安排。</p>
            ) : (
              (byDate.get(dayDrawer) ?? []).map((record) => <PlanChip key={record.id} record={record} />)
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
