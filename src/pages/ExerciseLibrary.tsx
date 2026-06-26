import { useEffect, useMemo, useState } from 'react';
import { addExercise, getAllExercises } from '../lib/db';
import { EQUIPMENT_TYPES, MUSCLE_GROUPS } from '../types';
import type { Equipment, Exercise, MuscleGroup } from '../types';
import { IconChevronDown, IconEmptyWorkout, IconInfo } from '../components/icons';
import ExerciseInfoPanel from '../components/ExerciseInfoPanel';

export default function ExerciseLibrary() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MuscleGroup | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const refresh = () => getAllExercises().then((list) => setExercises(list.sort((a, b) => a.name.localeCompare(b.name))));

  useEffect(() => { refresh(); }, []);

  const toggleInfo = (id: string) => {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      if (filter !== 'all' && ex.muscleGroup !== filter) return false;
      if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [exercises, search, filter]);

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Exercise Library</h1>
        <button className="btn" onClick={() => setShowForm(true)}>+ Add</button>
      </div>

      <input
        className="input search-bar"
        placeholder="Search exercises…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="filter-chips">
        <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        {MUSCLE_GROUPS.map((mg) => (
          <button key={mg} className={`chip ${filter === mg ? 'active' : ''}`} onClick={() => setFilter(mg)}>{mg}</button>
        ))}
      </div>

      <div className="card">
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
        {filtered.map((ex) => {
          const isOpen = expanded.has(ex.id);
          return (
            <div className="exercise-list-item exercise-list-item-expandable exercise-list-item-static" key={ex.id}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div className="col" style={{ gap: 4 }}>
                  <span style={{ fontWeight: 700 }}>{ex.name}</span>
                  <span className="badge">{ex.muscleGroup}</span>
                </div>
                <span className="text-dim" style={{ fontSize: 12, textTransform: 'capitalize', flexShrink: 0, marginLeft: 'auto' }}>{ex.equipment}{ex.custom ? ' · custom' : ''}</span>
              </div>

              <button
                className="more-info-toggle"
                onClick={() => toggleInfo(ex.id)}
                aria-expanded={isOpen}
              >
                <IconInfo size={14} /> More info
                <IconChevronDown size={14} className={`chevron${isOpen ? ' open' : ''}`} />
              </button>
              {isOpen && <ExerciseInfoPanel exercise={ex} />}
            </div>
          );
        })}
      </div>

      {showForm && (
        <AddExerciseModal
          onClose={() => setShowForm(false)}
          onAdded={() => { setShowForm(false); refresh(); }}
        />
      )}
    </div>
  );
}

function AddExerciseModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('chest');
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [overview, setOverview] = useState('');
  const [howTo, setHowTo] = useState('');
  const [secondaryMuscles, setSecondaryMuscles] = useState<MuscleGroup[]>([]);

  const toggleSecondary = (mg: MuscleGroup) => {
    setSecondaryMuscles((cur) => (cur.includes(mg) ? cur.filter((m) => m !== mg) : [...cur, mg]));
  };

  const save = async () => {
    if (!name.trim()) return;
    const id = `custom-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    const secondary = secondaryMuscles.filter((m) => m !== muscleGroup);
    await addExercise({
      id, name: name.trim(), muscleGroup, equipment, custom: true,
      overview: overview.trim() || undefined,
      howTo: howTo.trim() || undefined,
      secondaryMuscles: secondary.length > 0 ? secondary : undefined,
    });
    onAdded();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 16 }}>New Exercise</h2>
        <div className="stack">
          <div className="col">
            <label className="text-dim" style={{ fontSize: 13 }}>Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bulgarian Split Squat" autoFocus />
          </div>
          <div className="col">
            <label className="text-dim" style={{ fontSize: 13 }}>Muscle group</label>
            <select className="select" value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}>
              {MUSCLE_GROUPS.map((mg) => <option key={mg} value={mg}>{mg}</option>)}
            </select>
          </div>
          <div className="col">
            <label className="text-dim" style={{ fontSize: 13 }}>Equipment</label>
            <select className="select" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
              {EQUIPMENT_TYPES.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
            </select>
          </div>
          <div className="col">
            <label className="text-dim" style={{ fontSize: 13 }}>Also worked (optional)</label>
            <div className="filter-chips" style={{ marginBottom: 0 }}>
              {MUSCLE_GROUPS.filter((mg) => mg !== muscleGroup).map((mg) => (
                <button
                  key={mg}
                  type="button"
                  className={`chip ${secondaryMuscles.includes(mg) ? 'active' : ''}`}
                  onClick={() => toggleSecondary(mg)}
                >{mg}</button>
              ))}
            </div>
          </div>
          <div className="col">
            <label className="text-dim" style={{ fontSize: 13 }}>Overview (optional)</label>
            <textarea
              className="input"
              rows={2}
              value={overview}
              onChange={(e) => setOverview(e.target.value)}
              placeholder="What it targets and why…"
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          <div className="col">
            <label className="text-dim" style={{ fontSize: 13 }}>How to perform (optional)</label>
            <textarea
              className="input"
              rows={3}
              value={howTo}
              onChange={(e) => setHowTo(e.target.value)}
              placeholder="Step-by-step execution…"
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          <div className="row">
            <button className="btn btn-secondary btn-block" onClick={onClose}>Cancel</button>
            <button className="btn btn-block" onClick={save} disabled={!name.trim()}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
