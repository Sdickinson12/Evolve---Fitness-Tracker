import { useEffect, useRef, useState } from 'react';
import { IconChevronDown, IconClose, IconFlame, IconInfo, IconTrash } from './icons';
import ExerciseInfoPanel from './ExerciseInfoPanel';
import { exerciseCalories } from '../lib/calculations';
import type { Exercise, WorkoutExercise } from '../types';

export default function ExerciseBlock({
  we, priorPR, exercise, onAddSet, onDeleteSet, onRemove,
}: {
  we: WorkoutExercise;
  priorPR?: { weight: number; reps: number; date: string };
  exercise?: Exercise;
  onAddSet: (reps: number, weight: number) => void;
  onDeleteSet: (setId: string) => void;
  onRemove: () => void;
}) {
  const lastSet = we.sets[we.sets.length - 1];
  // Prefill from the previous set so repeating the same reps/weight across sets
  // (the common case) needs zero typing — still freely editable before adding.
  const [reps, setReps] = useState(lastSet ? String(lastSet.reps) : '');
  const [weight, setWeight] = useState(lastSet ? String(lastSet.weight) : '');
  const [flashId, setFlashId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const prevLenRef = useRef(we.sets.length);

  useEffect(() => {
    if (we.sets.length > prevLenRef.current) {
      const newest = we.sets[we.sets.length - 1];
      setFlashId(newest.id);
      const t = setTimeout(() => setFlashId(null), 900);
      prevLenRef.current = we.sets.length;
      return () => clearTimeout(t);
    }
    if (we.sets.length < prevLenRef.current) {
      // A set was deleted — resync the inputs to whatever is now the last set.
      const newLast = we.sets[we.sets.length - 1];
      setReps(newLast ? String(newLast.reps) : '');
      setWeight(newLast ? String(newLast.weight) : '');
    }
    prevLenRef.current = we.sets.length;
  }, [we.sets.length, we.sets]);

  const submit = () => {
    const r = parseInt(reps, 10);
    const w = parseFloat(weight);
    if (!Number.isFinite(r) || r <= 0 || !Number.isFinite(w) || w < 0) return;
    onAddSet(r, w);
    // Leave the just-used reps/weight in place — the next set usually repeats them.
  };

  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="col" style={{ gap: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{we.exerciseName}</span>
          <span className="badge">{we.muscleGroup}</span>
        </div>
        <button className="icon-btn" onClick={onRemove} aria-label="Remove exercise"><IconClose /></button>
      </div>

      {we.sets.length > 0 && (
        <div>
          {we.sets.map((s, i) => {
            const isPR = s.weight > 0 && (!priorPR || s.weight > priorPR.weight);
            return (
              <div className={`set-row${s.id === flashId ? ' set-row-new' : ''}`} key={s.id}>
                <span className="set-index">{i + 1}</span>
                <span style={{ flex: 1 }}>{s.reps} reps × {s.weight} kg</span>
                {isPR && <span className="pr-badge">PR</span>}
                <button className="icon-btn" onClick={() => onDeleteSet(s.id)} aria-label="Delete set"><IconTrash /></button>
              </div>
            );
          })}
          <div className="row" style={{ justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
            <IconFlame size={13} className="text-dim" />
            <span className="text-dim" style={{ fontSize: 12.5 }}>{Math.round(exerciseCalories(we))} kcal</span>
          </div>
        </div>
      )}

      <div className="set-input-row">
        <input
          className="input"
          type="number"
          inputMode="numeric"
          placeholder="Reps"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
        />
        <input
          className="input"
          type="number"
          inputMode="decimal"
          placeholder="Weight (kg)"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
        <button className="btn" onClick={submit}>Add Set</button>
      </div>

      <div>
        <button
          className="more-info-toggle"
          onClick={() => setShowInfo((v) => !v)}
          aria-expanded={showInfo}
        >
          <IconInfo size={14} /> More info
          <IconChevronDown size={14} className={`chevron${showInfo ? ' open' : ''}`} />
        </button>
        {showInfo && (
          <ExerciseInfoPanel
            exercise={exercise ?? { id: we.exerciseId, name: we.exerciseName, muscleGroup: we.muscleGroup, equipment: 'bodyweight' }}
          />
        )}
      </div>
    </div>
  );
}
