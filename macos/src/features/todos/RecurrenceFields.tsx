import type { RecurrenceFrequency, RecurrenceRule } from '../../domain/models';

const UNIT: Record<RecurrenceFrequency, string> = {
  daily: '天',
  weekly: '周',
  monthly: '月',
};

export function RecurrenceFields({
  value,
  onChange,
}: {
  value: RecurrenceRule | null;
  onChange: (value: RecurrenceRule | null) => void;
}) {
  return (
    <div className="recurrence-fields">
      <div>
        <label className="form-label" htmlFor="recurrence-frequency">重复频率</label>
        <select
          id="recurrence-frequency"
          className="form-select"
          value={value?.frequency ?? 'none'}
          onChange={(event) =>
            onChange(
              event.target.value === 'none'
                ? null
                : { frequency: event.target.value as RecurrenceFrequency, interval: value?.interval ?? 1 },
            )
          }
        >
          <option value="none">不重复</option>
          <option value="daily">每天</option>
          <option value="weekly">每周</option>
          <option value="monthly">每月</option>
        </select>
      </div>
      {value && (
        <div>
          <label className="form-label" htmlFor="recurrence-interval">重复间隔</label>
          <input
            id="recurrence-interval"
            className="form-input"
            type="number"
            min="1"
            max="99"
            value={value.interval}
            onChange={(event) => {
              const interval = Math.min(99, Math.max(1, Number.parseInt(event.target.value, 10) || 1));
              onChange({ ...value, interval });
            }}
          />
        </div>
      )}
      {value && (
        <div className="recurrence-preview">
          {value.interval === 1 ? `每${UNIT[value.frequency]}重复` : `每 ${value.interval} ${UNIT[value.frequency]}重复`}
        </div>
      )}
    </div>
  );
}
