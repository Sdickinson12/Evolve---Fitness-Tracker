import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell,
} from 'recharts';
import { getAllExercises, getAllWorkouts, getSettings } from '../lib/db';
import {
  calcStreak, dateNDaysAgo, DEFAULT_BODYWEIGHT_KG, epley1RM, formatDuration, lifetimeVolume,
  oneRmSeriesForExercise, percentDelta, personalRecords, summarizePeriod, volumeByMuscleGroup,
  weeklyVolumeSeries,
} from '../lib/calculations';
import { MUSCLE_GROUPS } from '../types';
import type { Exercise, Workout } from '../types';
import { IconFlame, IconTrendDown, IconTrendUp } from '../components/icons';
import LoadingState from '../components/LoadingState';

const CHART_TOOLTIP_STYLE = { background: '#1a1c21', border: '1px solid #2a2d34', borderRadius: 10 };
const CHART_AXIS_TICK = { fill: '#9aa0aa', fontSize: 11 };
const SHORT_DATE = (v: string) => new Date(v + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

type Timeframe = '4w' | '12w' | '1y' | 'all';
const TIMEFRAME_DAYS: Record<'4w' | '12w' | '1y', number> = { '4w': 28, '12w': 84, '1y': 365 };
const TIMEFRAMES: { id: Timeframe; label: string }[] = [
  { id: '4w', label: '4W' },
  { id: '12w', label: '12W' },
  { id: '1y', label: '1Y' },
  { id: 'all', label: 'All' },
];

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  return (
    <span className={`trend-badge ${pct >= 0 ? 'trend-up' : 'trend-down'}`}>
      {pct >= 0 ? <IconTrendUp /> : <IconTrendDown />}
      {Math.abs(pct)}%
    </span>
  );
}

export default function Stats() {
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  const [timeframe, setTimeframe] = useState<Timeframe>('12w');
  const [bodyWeightKg, setBodyWeightKg] = useState<number | null>(null);

  useEffect(() => {
    getAllWorkouts().then(setWorkouts);
    getAllExercises().then(setExercises);
    getSettings().then((s) => setBodyWeightKg(s?.bodyWeightKg ?? null)).catch(() => {});
  }, []);

  const exerciseMap = useMemo(() => {
    const m: Record<string, Exercise> = {};
    for (const ex of exercises) m[ex.id] = ex;
    return m;
  }, [exercises]);

  const allTimePrs = useMemo(() => (workouts ? personalRecords(workouts) : {}), [workouts]);
  const allTimeTrainedIds = useMemo(() => Object.keys(allTimePrs), [allTimePrs]);

  const now = new Date();
  const periodStart = timeframe === 'all' ? null : dateNDaysAgo(TIMEFRAME_DAYS[timeframe], now);
  const periodWorkouts = useMemo(() => {
    if (!workouts) return [];
    return periodStart ? workouts.filter((w) => w.date >= periodStart) : workouts;
  }, [workouts, periodStart]);
  const prevPeriodWorkouts = useMemo(() => {
    if (!workouts || !periodStart || timeframe === 'all') return [];
    const days = TIMEFRAME_DAYS[timeframe];
    const prevStart = dateNDaysAgo(days * 2, now);
    return workouts.filter((w) => w.date >= prevStart && w.date < periodStart);
    // `now` is intentionally excluded — it's a fresh Date() every render and
    // periodStart (derived from it) is already a tracked dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, periodStart, timeframe]);

  const trainedInPeriodIds = useMemo(
    () => [...new Set(periodWorkouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)))],
    [periodWorkouts]
  );

  useEffect(() => {
    if (trainedInPeriodIds.length === 0) return;
    if (!trainedInPeriodIds.includes(selectedExerciseId)) {
      setSelectedExerciseId(trainedInPeriodIds[0]);
    }
  }, [trainedInPeriodIds, selectedExerciseId]);

  if (!workouts) return <LoadingState />;

  const weight = bodyWeightKg ?? DEFAULT_BODYWEIGHT_KG;
  const current = summarizePeriod(periodWorkouts, weight);
  const previous = timeframe !== 'all' ? summarizePeriod(prevPeriodWorkouts, weight) : null;

  const streak = calcStreak(workouts, now);
  const lifetimeVol = lifetimeVolume(workouts);

  const volumeSeries = weeklyVolumeSeries(periodWorkouts);
  const oneRmSeries = selectedExerciseId ? oneRmSeriesForExercise(periodWorkouts, selectedExerciseId) : [];
  const currentOneRm = oneRmSeries.length > 0 ? oneRmSeries[oneRmSeries.length - 1].oneRm : null;
  const startingOneRm = oneRmSeries.length > 0 ? oneRmSeries[0].oneRm : null;
  const oneRmDeltaPct = currentOneRm !== null && startingOneRm !== null ? percentDelta(currentOneRm, startingOneRm) : null;

  const muscleVolumes = volumeByMuscleGroup(periodWorkouts);
  const muscleBars = [...MUSCLE_GROUPS]
    .map((mg) => ({ muscle: mg, volume: muscleVolumes[mg] ?? 0 }))
    .sort((a, b) => b.volume - a.volume)
    .filter((d) => d.volume > 0);

  const comparisons = [
    { label: 'Volume', value: `${Math.round(current.volume).toLocaleString()} kg`, delta: previous ? percentDelta(current.volume, previous.volume) : null },
    { label: 'Workouts', value: String(current.workouts), delta: previous ? percentDelta(current.workouts, previous.workouts) : null },
    { label: 'Calories Burnt', value: Math.round(current.calories).toLocaleString(), delta: previous ? percentDelta(current.calories, previous.calories) : null },
    { label: 'Gym Time', value: current.durationSec > 0 ? formatDuration(current.durationSec) : '—', delta: previous ? percentDelta(current.durationSec, previous.durationSec) : null },
  ];

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Stats</h1>
        <div className="view-toggle">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.id}
              className={`view-toggle-btn${timeframe === tf.id ? ' active' : ''}`}
              onClick={() => setTimeframe(tf.id)}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      <div className="row" style={{ gap: 16 }}>
        <span className="row" style={{ gap: 6 }}>
          <IconFlame size={16} className={streak > 0 ? 'text-accent' : 'text-dim'} />
          <span className="text-dim" style={{ fontSize: 13 }}><strong style={{ color: 'var(--text)' }}>{streak}</strong> week streak</span>
        </span>
        <span className="text-dim" style={{ fontSize: 13 }}>
          <strong style={{ color: 'var(--text)' }}>{Math.round(lifetimeVol).toLocaleString()} kg</strong> lifetime volume
        </span>
      </div>

      <div className="card-grid">
        {comparisons.map((c) => (
          <div className="card stat-tile" key={c.label}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="stat-label">{c.label}</span>
              <TrendBadge pct={c.delta} />
            </div>
            <span className="stat-value">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="section-label">Strength Progress</div>
      <div className="card glow-card">
        <select
          className="select"
          style={{ marginBottom: 16 }}
          value={selectedExerciseId}
          onChange={(e) => setSelectedExerciseId(e.target.value)}
        >
          {trainedInPeriodIds.length === 0 && <option value="">No exercises trained in this period</option>}
          {trainedInPeriodIds.map((id) => (
            <option key={id} value={id}>{exerciseMap[id]?.name ?? id}</option>
          ))}
        </select>

        {oneRmSeries.length > 0 ? (
          <>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div className="col" style={{ gap: 2 }}>
                <span className="stat-label">Est. 1RM</span>
                <span className="stat-value text-accent">{Math.round(currentOneRm ?? 0)} kg</span>
              </div>
              <TrendBadge pct={oneRmDeltaPct} />
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={oneRmSeries}>
                <CartesianGrid stroke="#2a2d34" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={CHART_AXIS_TICK} tickFormatter={SHORT_DATE} />
                <YAxis tick={CHART_AXIS_TICK} width={40} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={{ color: '#f5f6f7' }}
                  formatter={(value) => [`${Math.round(Number(value))} kg`, 'Est. 1RM']}
                  labelFormatter={(v) => new Date(v + 'T00:00:00').toLocaleDateString()}
                />
                <Line type="monotone" dataKey="oneRm" stroke="#a855f7" strokeWidth={2.5} dot={{ r: 3, fill: '#a855f7' }} />
              </LineChart>
            </ResponsiveContainer>
          </>
        ) : (
          <div className="empty-state">No data for this exercise in this period.</div>
        )}
      </div>

      <div className="section-label">Volume Trend</div>
      <div className="card">
        {volumeSeries.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={volumeSeries}>
              <CartesianGrid stroke="#2a2d34" strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={CHART_AXIS_TICK} tickFormatter={SHORT_DATE} />
              <YAxis tick={CHART_AXIS_TICK} width={40} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={{ color: '#f5f6f7' }}
                formatter={(value) => [`${Math.round(Number(value)).toLocaleString()} kg`, 'Volume']}
                labelFormatter={(v) => new Date(v + 'T00:00:00').toLocaleDateString()}
              />
              <Line type="monotone" dataKey="volume" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 3, fill: '#ec4899' }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-state">No volume logged in this period.</div>
        )}
      </div>

      <div className="section-label">Volume by Muscle Group</div>
      <div className="card">
        {muscleBars.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(180, muscleBars.length * 34)}>
            <BarChart data={muscleBars} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid stroke="#2a2d34" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={CHART_AXIS_TICK} />
              <YAxis
                type="category"
                dataKey="muscle"
                tick={CHART_AXIS_TICK}
                width={80}
                tickFormatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={{ color: '#f5f6f7', textTransform: 'capitalize' }}
                formatter={(value) => [`${Math.round(Number(value)).toLocaleString()} kg`, 'Volume']}
              />
              <Bar dataKey="volume" radius={[0, 6, 6, 0]}>
                {muscleBars.map((d, i) => (
                  <Cell key={d.muscle} fill={i === 0 ? '#a855f7' : '#3a2f4a'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-state">No volume logged in this period.</div>
        )}
      </div>

      <span className="section-label" style={{ marginBottom: -6 }}>Personal Records</span>
      <span className="text-dim" style={{ fontSize: 12 }}>All-time bests, regardless of timeframe</span>
      <div className="card" style={{ marginTop: 4 }}>
        {allTimeTrainedIds.length === 0 && <div className="empty-state">No PRs yet — log a workout to get started.</div>}
        {allTimeTrainedIds.map((exId) => {
          const ex = exerciseMap[exId];
          const pr = allTimePrs[exId];
          const oneRm = pr.reps <= 10 ? epley1RM(pr.weight, pr.reps) : null;
          return (
            <div className="exercise-list-item" key={exId}>
              <div className="col" style={{ gap: 4 }}>
                <span style={{ fontWeight: 600 }}>{ex?.name ?? exId}</span>
                <span className="text-dim" style={{ fontSize: 12 }}>{pr.weight} kg × {pr.reps} reps</span>
              </div>
              {oneRm !== null && (
                <span className="badge">~{Math.round(oneRm)} kg 1RM</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
