import type { LiteratureDetails, ReadingStatus } from '../../domain/models';
import { READING_STATUS_LABEL } from './readingStatus';

export function LiteratureFields({
  value,
  onChange,
}: {
  value: LiteratureDetails;
  onChange: (value: LiteratureDetails) => void;
}) {
  const patch = (next: Partial<LiteratureDetails>) => onChange({ ...value, ...next });
  return (
    <div className="literature-fields">
      <div className="form-row">
        <div><label className="form-label">作者</label><input className="form-input" value={value.authors} onChange={(event) => patch({ authors: event.target.value })} placeholder="作者或作者列表" /></div>
        <div><label className="form-label">年份</label><input className="form-input" type="number" min="1000" max={new Date().getFullYear() + 1} value={value.year ?? ''} onChange={(event) => patch({ year: event.target.value ? Number(event.target.value) : null })} /></div>
        <div><label className="form-label">阅读状态</label><select className="form-select" value={value.readingStatus} onChange={(event) => patch({ readingStatus: event.target.value as ReadingStatus })}>{(Object.keys(READING_STATUS_LABEL) as ReadingStatus[]).map((status) => <option key={status} value={status}>{READING_STATUS_LABEL[status]}</option>)}</select></div>
      </div>
      <div className="form-row">
        <div><label className="form-label">DOI</label><input className="form-input" value={value.doi} onChange={(event) => patch({ doi: event.target.value })} placeholder="10.xxxx/…" /></div>
        <div><label className="form-label">HTTPS 链接</label><input className="form-input" type="url" value={value.url} onChange={(event) => patch({ url: event.target.value })} placeholder="https://…" /></div>
      </div>
    </div>
  );
}
