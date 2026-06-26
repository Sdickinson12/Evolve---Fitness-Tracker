import { useState } from 'react';
import { IconChevronDown, IconInfo, IconEmptyWorkout } from './icons';
import ExerciseInfoPanel from './ExerciseInfoPanel';
import { MUSCLE_GROUPS } from '../types';
import type { Exercise, MuscleGroup } from '../types';

export default function ExercisePickerModal({
  exercises, onPick, onClose,
}: { exercises: Exercise[]; onPick: (ex: Exercise) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MuscleGroup | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const filtered = exercises
    .filter((ex) => filter === 'all' || ex.muscleGroup === filter)
    .filter((ex) => ex.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const toggleInfo = (id: string) => {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 12 }}>Add Exercise</h2>
        <input
          className="input search-bar"
          placeholder="Search exercises…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        <div className="filter-chips">
          <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          {MUSCLE_GROUPS.map((mg) => (
            <button key={mg} className={`chip ${filter === mg ? 'active' : ''}`} onClick={() => setFilter(mg)}>{mg}</button>
          ))}
        </div>

        <div>
          {filtered.map((ex) => {
            const isOpen = expanded.has(ex.id);
            return (
              <div className="exercise-list-item exercise-list-item-expandable" key={ex.id}>
                <div
                  className="row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onPick(ex)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(ex); } }}
                >
                  <div className="col" style={{ gap: 4 }}>
                    <span style={{ fontWeight: 600 }}>{ex.name}</span>
                    <span className="badge">{ex.muscleGroup}</span>
                  </div>
                  <span className="text-dim" style={{ fontSize: 12, textTransform: 'capitalize', marginLeft: 'auto' }}>{ex.equipment}</span>
                </div>

                <button
                  className="more-info-toggle"
                  onClick={(e) => { e.stopPropagation(); toggleInfo(ex.id); }}
                  aria-expanded={isOpen}
                >
                  <IconInfo size={14} /> More info
                  <IconChevronDown size={14} className={`chevron${isOpen ? ' open' : ''}`} />
                </button>
                {isOpen && <ExerciseInfoPanel exercise={ex} />}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="empty-state">
              <IconEmptyWorkout className="empty-state-icon" />
              <p>{search ? `No exercises match "${search}".` : `No ${filter} exercises in your library.`}</p>
              {(search || filter !== 'all') && (
                <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => { setSearch(''); setFilter('all'); }}>
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
