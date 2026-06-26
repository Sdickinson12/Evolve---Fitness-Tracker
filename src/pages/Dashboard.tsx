import { useEffect, useState, type CSSProperties } from 'react';
import { getActiveSession, getAllWorkouts, getSettings } from '../lib/db';
import {
  calcStreak, DEFAULT_BODYWEIGHT_KG, formatDuration, getCurrentWeekWorkouts, getPreviousWeekWorkouts,
  getWeekRange, prsAchievedSince, totalDurationSec, volumeByMuscleGroup, workoutCalories, workoutVolume,
} from '../lib/calculations';
import { useCountUp } from '../lib/useCountUp';
import { formatElapsed, useElapsedTime } from '../lib/useElapsedTime';
import { heatColor, heatLabel } from '../lib/heatColor';
import { MUSCLE_GROUPS } from '../types';
import type { Page } from '../App';
import type { ActiveSession, MuscleGroup, Workout } from '../types';
import type { PRHit } from '../lib/calculations';
import BodyHeatmap from '../components/BodyHeatmap';
import LoadingState from '../components/LoadingState';
import { IconEmptyWorkout, IconFlame, IconPlay, IconTrendDown, IconTrendUp } from '../components/icons';

const WELL_TRAINED_THRESHOLD = 3000; // kg total volume for "well trained"

function statusColor(volume: number): { color: string; label: string } {
  return { color: heatColor(volume, WELL_TRAINED_THRESHOLD), label: heatLabel(volume, WELL_TRAINED_THRESHOLD) };
}

function weekRangeLabel(now: Date): string {
  const { start, end } = getWeekRange(now);
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

// Keep only the highest jump per exercise reached this week — a lifter who
// re-breaks their own PR across two sessions in the same week should see one
// line, not a duplicate per session.
function latestPerExercise(hits: PRHit[]): PRHit[] {
  const byExercise = new Map<string, PRHit>();
  for (const hit of hits) byExercise.set(hit.exerciseId, hit);
  return [...byExercise.values()];
}

export default function Dashboard({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<MuscleGroup | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [bodyWeightKg, setBodyWeightKg] = useState<number | null>(null);
  const liveElapsedSec = useElapsedTime(activeSession?.startedAt ?? null);

  const load = () => {
    setLoadError(false);
    getAllWorkouts().then(setWorkouts).catch(() => setLoadError(true));
    getActiveSession().then((s) => setActiveSession(s ?? null)).catch(() => {});
    getSettings().then((s) => setBodyWeightKg(s?.bodyWeightKg ?? null)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const now = new Date();
  const { start: weekStart } = getWeekRange(now);
  const weekWorkouts = workouts ? getCurrentWeekWorkouts(workouts, now) : [];
  const volumes = volumeByMuscleGroup(weekWorkouts);
  const totalVolume = Object.values(volumes).reduce((a, b) => a + b, 0);
  const animatedVolume = useCountUp(totalVolume);

  const lastWeekVolume = workouts
    ? Object.values(volumeByMuscleGroup(getPreviousWeekWorkouts(workouts, now))).reduce((a, b) => a + b, 0)
    : 0;
  const volumeDeltaPct = lastWeekVolume > 0 ? Math.round(((totalVolume - lastWeekVolume) / lastWeekVolume) * 100) : null;

  const gymTimeSec = totalDurationSec(weekWorkouts);
  const weekCalories = weekWorkouts.reduce(
    (sum, w) => sum + workoutCalories(w, bodyWeightKg ?? DEFAULT_BODYWEIGHT_KG, w.durationSec), 0
  );
  const streak = workouts ? calcStreak(workouts, now) : 0;
  const rankedMuscles = [...MUSCLE_GROUPS].sort((a, b) => volumes[b] - volumes[a]);
  const mostTrained = totalVolume > 0 ? rankedMuscles[0] : null;
  const needsWork = [...MUSCLE_GROUPS].sort((a, b) => volumes[a] - volumes[b]).slice(0, 3);
  const recentWorkouts = workouts ? [...workouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 3) : [];
  const prHits = workouts ? latestPerExercise(prsAchievedSince(workouts, weekStart)) : [];

  if (loadError) {
    return (
      <div className="empty-state">
        <p>Couldn't load your workouts. Check your connection and try again.</p>
        <button className="btn" style={{ marginTop: 16 }} onClick={load}>Retry</button>
      </div>
    );
  }

  if (!workouts) return <LoadingState />;

  if (workouts.length === 0) {
    return (
      <div className="stack">
        <h1 className="page-title">This Week</h1>
        <div className="empty-state">
          <IconEmptyWorkout className="empty-state-icon" />
          <p>No workouts logged yet.</p>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => onNavigate('log')}>Log Your First Workout</button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div className="col" style={{ gap: 4 }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>This Week</h1>
          <span className="text-dim" style={{ fontSize: 13 }}>{weekRangeLabel(now)}</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => onNavigate('log')}>+ Log Workout</button>
          <button className="btn" onClick={() => onNavigate('session')}>
            {activeSession ? (
              <>
                <IconPlay size={14} /> Resume · {formatElapsed(liveElapsedSec)}
              </>
            ) : (
              <>
                <IconPlay size={14} /> Start Workout
              </>
            )}
          </button>
        </div>
      </div>

      {prHits.length > 0 && (
        <div className="card glow-card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="section-label" style={{ marginBottom: 0 }}>
              New PR{prHits.length !== 1 ? 's' : ''} This Week
            </span>
            <span className="pr-badge">PR</span>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {prHits.map((hit) => (
              <div key={hit.exerciseId} className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{hit.exerciseName}</span>
                <span className="text-dim" style={{ fontSize: 13 }}>{hit.weight} kg × {hit.reps}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card glow-card stat-tile">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span className="stat-label">Total Volume</span>
          {volumeDeltaPct !== null && (
            <span className={`trend-badge ${volumeDeltaPct >= 0 ? 'trend-up' : 'trend-down'}`}>
              {volumeDeltaPct >= 0 ? <IconTrendUp /> : <IconTrendDown />}
              {Math.abs(volumeDeltaPct)}% vs last week
            </span>
          )}
        </div>
        <span className="stat-value text-accent">{Math.round(animatedVolume).toLocaleString()} kg</span>
      </div>

      <div className="card-grid">
        <div className="card stat-tile">
          <span className="stat-value">{formatDuration(gymTimeSec)}</span>
          <span className="stat-label">Gym Time This Week</span>
        </div>
        <div className="card stat-tile">
          <span className="row" style={{ gap: 6, alignItems: 'baseline' }}>
            <span className="stat-value text-accent">{streak}</span>
            {streak > 0 && <IconFlame size={18} className="text-accent" />}
          </span>
          <span className="stat-label">Week Streak</span>
        </div>
        <div className="card stat-tile">
          <span className="stat-value">{Math.round(weekCalories).toLocaleString()}</span>
          <span className="stat-label">Calories Burnt</span>
        </div>
        <div className="card stat-tile">
          <span className="stat-value" style={{ textTransform: 'capitalize' }}>{mostTrained ?? '—'}</span>
          <span className="stat-label">Most Trained Muscle</span>
        </div>
      </div>

      <div className="section-label">Could Use More Work</div>
      <div className="card">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {needsWork.map((mg) => (
            <button
              key={mg}
              className="badge badge-action"
              style={{ textTransform: 'capitalize' }}
              onClick={() => onNavigate('log')}
            >
              {mg}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span className="section-label" style={{ marginBottom: 0 }}>Select a muscle</span>
          <div className="row" style={{ gap: 14 }}>
            <Legend color={heatColor(0, WELL_TRAINED_THRESHOLD)} label="None" />
            <Legend color={heatColor(1, WELL_TRAINED_THRESHOLD)} label="Some" />
            <Legend color={heatColor(WELL_TRAINED_THRESHOLD, WELL_TRAINED_THRESHOLD)} label="Trained" />
          </div>
        </div>

        <BodyHeatmap
          volumes={volumes}
          threshold={WELL_TRAINED_THRESHOLD}
          selected={selected}
          onSelect={(mg) => setSelected((cur) => (cur === mg ? null : mg))}
        />
      </div>

      <div className="section-label">Muscle Groups</div>
      <div className="card-grid">
        {MUSCLE_GROUPS.map((mg, i) => {
          const vol = volumes[mg] ?? 0;
          const { color, label } = statusColor(vol);
          const pct = Math.min(100, (vol / WELL_TRAINED_THRESHOLD) * 100);
          return (
            <div
              className="card muscle-card rise-in"
              key={mg}
              role="button"
              tabIndex={0}
              onClick={() => setSelected((cur) => (cur === mg ? null : mg))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelected((cur) => (cur === mg ? null : mg));
                }
              }}
              style={{ cursor: 'pointer', outline: selected === mg ? '2px solid rgb(250, 204, 21)' : 'none', '--i': i } as CSSProperties}
            >
              <span className="name">{mg}</span>
              <span className="volume" style={{ color }}>{Math.round(vol).toLocaleString()}</span>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
              </div>
              <span className="text-dim" style={{ fontSize: 11 }}>{label}</span>
            </div>
          );
        })}
      </div>

      {weekWorkouts.length === 0 && (
        <div className="empty-state">
          <IconEmptyWorkout className="empty-state-icon" />
          <p>No workouts logged this week yet.</p>
          <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => onNavigate('log')}>Log a Workout</button>
        </div>
      )}

      {recentWorkouts.length > 0 && (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="section-label" style={{ marginBottom: 0 }}>Recent Workouts</span>
            <button className="link-btn" onClick={() => onNavigate('history')}>View all</button>
          </div>
          <div className="card" style={{ padding: 0 }}>
            {recentWorkouts.map((w) => {
              const vol = workoutVolume(w);
              const sets = w.exercises.reduce((sum, e) => sum + e.sets.length, 0);
              return (
                <div
                  className="exercise-list-item"
                  key={w.id}
                  onClick={() => onNavigate('history')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('history'); } }}
                  style={{ padding: '15px 16px' }}
                >
                  <div className="col" style={{ gap: 4 }}>
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <span style={{ fontWeight: 700 }}>{new Date(w.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                      <span className="badge">{w.name ?? 'Freestyle'}</span>
                    </div>
                    <span className="text-dim" style={{ fontSize: 13 }}>
                      {w.exercises.length} exercise{w.exercises.length !== 1 ? 's' : ''} · {sets} sets
                    </span>
                  </div>
                  <span style={{ fontWeight: 700 }}>{Math.round(vol).toLocaleString()} kg</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="row" style={{ gap: 5, alignItems: 'center' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span className="text-dim" style={{ fontSize: 11 }}>{label}</span>
    </span>
  );
}
