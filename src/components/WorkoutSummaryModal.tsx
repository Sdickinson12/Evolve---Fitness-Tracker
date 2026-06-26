import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../lib/db';
import { DEFAULT_BODYWEIGHT_KG, formatDuration, workoutCalories } from '../lib/calculations';
import { IconFlame } from './icons';
import BodyHeatmap from './BodyHeatmap';
import { MUSCLE_GROUPS } from '../types';
import type { ActiveSession, MuscleGroup } from '../types';

// The heatmap is just "was this muscle hit this workout", not a volume
// gradient — so it's keyed off set count rather than reps × weight, which
// would otherwise show nothing for bodyweight exercises (0 kg logged).
function muscleSetCounts(session: ActiveSession): Record<MuscleGroup, number> {
  const counts = {} as Record<MuscleGroup, number>;
  for (const mg of MUSCLE_GROUPS) counts[mg] = 0;
  for (const ex of session.exercises) counts[ex.muscleGroup] += ex.sets.length;
  return counts;
}

export default function WorkoutSummaryModal({
  session, endedAt, onClose,
}: {
  session: ActiveSession;
  endedAt: number;
  onClose: () => void;
}) {
  const [bodyWeightKg, setBodyWeightKg] = useState<number | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [editingWeight, setEditingWeight] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      if (s) {
        setBodyWeightKg(s.bodyWeightKg);
        setWeightInput(String(s.bodyWeightKg));
      } else {
        setWeightInput(String(DEFAULT_BODYWEIGHT_KG));
      }
    });
  }, []);

  const saveWeight = async () => {
    const kg = parseFloat(weightInput);
    if (!Number.isFinite(kg) || kg <= 0) return;
    await saveSettings({ id: 'profile', bodyWeightKg: kg });
    setBodyWeightKg(kg);
    setEditingWeight(false);
  };

  const totalSets = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const durationSec = Math.round((endedAt - session.startedAt) / 1000);
  const volume = session.exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + set.reps * set.weight, 0), 0
  );
  const calories = workoutCalories(session, bodyWeightKg ?? DEFAULT_BODYWEIGHT_KG, durationSec);
  const muscleCounts = muscleSetCounts(session);
  const muscleGroups = [...new Set(session.exercises.map((ex) => ex.muscleGroup))];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 4 }}>Workout complete</h2>
        <p className="text-dim" style={{ marginBottom: 20, fontSize: 13 }}>
          {session.name ?? 'Freestyle'} · nice work.
        </p>

        <div className="card-grid" style={{ marginBottom: 20 }}>
          <div className="card stat-tile">
            <span className="stat-label">Duration</span>
            <span className="stat-value">{formatDuration(durationSec)}</span>
          </div>
          <div className="card stat-tile glow-card">
            <span className="stat-label">Calories Burnt</span>
            <span className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconFlame size={22} />{Math.round(calories)}
            </span>
          </div>
          <div className="card stat-tile">
            <span className="stat-label">Total Volume</span>
            <span className="stat-value">{Math.round(volume)} kg</span>
          </div>
          <div className="card stat-tile">
            <span className="stat-label">Sets</span>
            <span className="stat-value">{totalSets}</span>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          {editingWeight ? (
            <div className="row" style={{ gap: 8 }}>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                placeholder="Body weight (kg)"
                style={{ flex: 1 }}
                autoFocus
              />
              <button className="btn btn-secondary" onClick={saveWeight}>Save</button>
            </div>
          ) : (
            <button className="link-btn" onClick={() => setEditingWeight(true)}>
              {bodyWeightKg ? `Calories based on ${bodyWeightKg} kg body weight — edit` : 'Set your body weight for more accurate calories'}
            </button>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Muscles Hit ({session.exercises.length} exercise{session.exercises.length !== 1 ? 's' : ''})</span>
          <BodyHeatmap volumes={muscleCounts} threshold={1} />
          <div className="row" style={{ flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {muscleGroups.map((mg) => (
              <span key={mg} className="badge">{mg}</span>
            ))}
          </div>
        </div>

        <button className="btn btn-block" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
