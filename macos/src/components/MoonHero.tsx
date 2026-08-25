import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../stores';
import { countRecordsByType } from '../store/selectors';
import { FloatingNotes } from './MusicNotes';

const PALETTE = [
  '#d9a441',
  '#c96442',
  '#f2edde',
  '#7c9a6d',
  '#8fa3bf',
  '#e6a15c',
  '#a9512f',
  '#cfc9b4',
  '#6d8a7c',
  '#b0879f',
];

const DAY = 86400000;

/** 「月之暗面」主题图表：月相环形图（类型分布）+ 声浪曲线（近 14 天活跃） */
export function MoonHero() {
  const { records, types, setView, setStatusFilter } = useStore(
    useShallow((state) => ({
      records: state.records,
      types: state.types,
      setView: state.setView,
      setStatusFilter: state.setStatusFilter,
    })),
  );
  const navigateToType = (typeId: string) => {
    setStatusFilter('all');
    setView(typeId);
  };

  const counts = useMemo(() => {
    const countsByType = countRecordsByType(records, types);
    return types.map((t) => ({ t, n: countsByType[t.id] })).filter((x) => x.n > 0);
  }, [records, types]);
  const total = counts.reduce((s, x) => s + x.n, 0);

  const days = useMemo(() => {
    const out: Array<{ label: string; n: number }> = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i).getTime();
      out.push({
        label: `${new Date(start).getMonth() + 1}/${new Date(start).getDate()}`,
        n: records.filter((r) => r.updatedAt >= start && r.updatedAt < start + DAY).length,
      });
    }
    return out;
  }, [records]);

  const R = 56;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const segs = counts.map((x, i) => {
    const seg = {
      key: x.t.id,
      name: x.t.name,
      n: x.n,
      color: PALETTE[i % PALETTE.length],
      frac: total ? x.n / total : 0,
      offset: acc,
    };
    acc += seg.frac;
    return seg;
  });

  const maxN = Math.max(1, ...days.map((d) => d.n));

  return (
    <section className="moon-hero">
      <FloatingNotes count={5} seed={11} />
      <div className="hero-block">
        <div className="hero-title serif">月相 · 记录分布</div>
        <div className="hero-donut-wrap">
          <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label="类型分布">
            <defs>
              <radialGradient id="moonGrad" cx="38%" cy="34%" r="75%">
                <stop offset="0%" stopColor="#f7f1e0" />
                <stop offset="55%" stopColor="#e6ddc4" />
                <stop offset="100%" stopColor="#c9bd9c" />
              </radialGradient>
            </defs>
            <circle cx="66" cy="66" r={R} fill="none" stroke="rgba(242,237,222,0.12)" strokeWidth="16" />
            {segs.map((s) => (
              <circle
                key={s.key}
                className="donut-segment"
                role="button"
                tabIndex={0}
                aria-label={`查看${s.name}，${s.n} 条记录`}
                onClick={() => navigateToType(s.key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') navigateToType(s.key);
                }}
                cx="66"
                cy="66"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${Math.max(0, s.frac * C - 3)} ${C}`}
                strokeDashoffset={-s.offset * C + C / 4}
              />
            ))}
            <circle cx="66" cy="66" r="33" fill="url(#moonGrad)" />
            <text x="66" y="64" textAnchor="middle" className="donut-num">
              {total}
            </text>
            <text x="66" y="81" textAnchor="middle" className="donut-label">
              条记录
            </text>
          </svg>
          <div className="hero-legend">
            {segs.map((s) => (
              <button
                key={s.key}
                className="legend-row"
                aria-label={`${s.name}，${s.n} 条记录`}
                onClick={() => navigateToType(s.key)}
              >
                <span className="legend-dot" style={{ background: s.color }} />
                {s.name}
                <span className="legend-n">{s.n}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hero-block hero-wave-block">
        <div className="hero-title serif">声浪 · 近 14 天活跃</div>
        <svg viewBox="0 0 420 120" className="hero-wave" preserveAspectRatio="none" role="img" aria-label="近 14 天活跃">
          <line x1="0" y1="60" x2="420" y2="60" stroke="rgba(242,237,222,0.18)" strokeWidth="1" />
          {days.map((d, i) => {
            const h = 5 + (d.n / maxN) * 42;
            const x = i * 30 + 9;
            const op = 0.4 + 0.6 * (d.n / maxN);
            return (
              <g key={i}>
                <rect x={x} y={60 - h} width="12" height={h} rx="5" fill="#d9a441" opacity={op} />
                <rect x={x} y={60} width="12" height={h * 0.55} rx="5" fill="#c96442" opacity={op * 0.8} />
              </g>
            );
          })}
        </svg>
        <div className="hero-wave-labels">
          <span>{days[0]?.label}</span>
          <span>{days[13]?.label}</span>
        </div>
      </div>
    </section>
  );
}
