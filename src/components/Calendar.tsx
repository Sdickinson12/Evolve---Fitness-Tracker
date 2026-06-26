import { useState } from 'react';
import { toDateKey } from '../lib/calculations';
import { IconChevronLeft, IconChevronRight } from './icons';

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function buildMonthGrid(monthStart: Date): (Date | null)[] {
  const firstDow = monthStart.getDay(); // 0 = Sunday
  const leading = firstDow === 0 ? 6 : firstDow - 1; // Monday-start offset
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function Calendar({
  selected,
  markedDates,
  onSelect,
}: {
  selected: string | null;
  markedDates: Set<string>;
  onSelect: (dateKey: string) => void;
}) {
  const initial = selected ? new Date(selected + 'T00:00:00') : new Date();
  const [viewMonth, setViewMonth] = useState(startOfMonth(initial));

  const cells = buildMonthGrid(viewMonth);
  const todayKey = toDateKey(new Date());
  const monthLabel = viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const shiftMonth = (delta: number) => {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button className="calendar-nav-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          <IconChevronLeft size={16} />
        </button>
        <span className="calendar-month-label">{monthLabel}</span>
        <button className="calendar-nav-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
          <IconChevronRight size={16} />
        </button>
      </div>

      <div className="calendar-weekdays">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((date, i) => {
          if (!date) return <span key={i} className="calendar-day calendar-day-empty" />;
          const key = toDateKey(date);
          const isSelected = key === selected;
          const isToday = key === todayKey;
          const hasData = markedDates.has(key);
          return (
            <button
              key={key}
              className={`calendar-day${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}${hasData ? ' has-data' : ''}`}
              onClick={() => onSelect(key)}
            >
              {date.getDate()}
              {hasData && <span className="calendar-dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
