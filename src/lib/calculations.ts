import type { MuscleGroup, Workout, WorkoutExercise } from '../types';
import { MUSCLE_GROUPS } from '../types';

// Calories burned = MET (metabolic equivalent) × body weight (kg) × duration
// (hours) — the standard formula behind essentially every fitness-tracker
// calorie estimate, cardio or strength. Used here in place of the previous
// volume-only guess.
export const DEFAULT_BODYWEIGHT_KG = 70; // used until the user sets their own in Stats

// MET values for resistance training, from the Compendium of Physical
// Activities "weight lifting" entries (light/moderate effort ~3.5, vigorous
// ~6.0). A set's relative intensity isn't known directly (no tracked 1RM),
// so it's approximated from rep range: low reps imply lifting close to a
// max (vigorous), high reps imply lighter, more moderate effort.
function metForReps(reps: number): number {
  if (reps <= 6) return 6.0;
  if (reps <= 12) return 5.0;
  return 3.5;
}

// Seconds of work assumed per rep (concentric + eccentric) plus typical
// inter-set rest — stands in for real elapsed time when a set is still being
// logged and the actual session duration isn't known yet.
const SECONDS_PER_REP = 3;
const REST_SECONDS_PER_SET = 75;

export function estimatedSetDurationSec(reps: number): number {
  return reps * SECONDS_PER_REP + REST_SECONDS_PER_SET;
}

export function setCalories(reps: number, bodyWeightKg = DEFAULT_BODYWEIGHT_KG, durationSec?: number): number {
  const met = metForReps(reps);
  const sec = durationSec ?? estimatedSetDurationSec(reps);
  return met * bodyWeightKg * (sec / 3600);
}

export function exerciseCalories(we: WorkoutExercise, bodyWeightKg = DEFAULT_BODYWEIGHT_KG): number {
  return we.sets.reduce((sum, s) => sum + setCalories(s.reps, bodyWeightKg), 0);
}

// Total calories for a finished workout/session. When the real elapsed
// duration is known, each set's MET-weighted share of time is rescaled so the
// estimates add up to that actual duration instead of the rep/rest guess —
// keeping the per-set intensity model but anchoring total time to what really
// happened.
export function workoutCalories(
  workout: { exercises: WorkoutExercise[] },
  bodyWeightKg = DEFAULT_BODYWEIGHT_KG,
  durationSec?: number
): number {
  const sets = workout.exercises.flatMap((ex) => ex.sets);
  if (sets.length === 0) return 0;
  const estimatedTotalSec = sets.reduce((sum, s) => sum + estimatedSetDurationSec(s.reps), 0);
  const scale = durationSec != null && estimatedTotalSec > 0 ? durationSec / estimatedTotalSec : 1;
  return sets.reduce((sum, s) => {
    const sec = estimatedSetDurationSec(s.reps) * scale;
    return sum + metForReps(s.reps) * bodyWeightKg * (sec / 3600);
  }, 0);
}

export function volumesForExercises(exercises: WorkoutExercise[]): Record<MuscleGroup, number> {
  const result: Record<MuscleGroup, number> = {} as Record<MuscleGroup, number>;
  for (const mg of MUSCLE_GROUPS) result[mg] = 0;
  for (const ex of exercises) {
    const setVolume = ex.sets.reduce((sum, s) => sum + s.reps * s.weight, 0);
    result[ex.muscleGroup] = (result[ex.muscleGroup] ?? 0) + setVolume;
  }
  return result;
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Monday-start week range containing the given date
export function getWeekRange(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const dow = d.getDay(); // 0 = Sunday
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toDateKey(monday), end: toDateKey(sunday) };
}

export function isWithinRange(dateKey: string, start: string, end: string): boolean {
  return dateKey >= start && dateKey <= end;
}

export function workoutVolume(workout: Workout): number {
  let total = 0;
  for (const ex of workout.exercises) {
    for (const s of ex.sets) {
      total += s.reps * s.weight;
    }
  }
  return total;
}

export function volumeByMuscleGroup(workouts: Workout[]): Record<MuscleGroup, number> {
  const result: Record<MuscleGroup, number> = {} as Record<MuscleGroup, number>;
  for (const mg of MUSCLE_GROUPS) result[mg] = 0;
  for (const w of workouts) {
    const perWorkout = volumesForExercises(w.exercises);
    for (const mg of MUSCLE_GROUPS) result[mg] += perWorkout[mg];
  }
  return result;
}

export function epley1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export function getCurrentWeekWorkouts(workouts: Workout[], now: Date = new Date()): Workout[] {
  const { start, end } = getWeekRange(now);
  return workouts.filter((w) => isWithinRange(w.date, start, end));
}

export function getPreviousWeekWorkouts(workouts: Workout[], now: Date = new Date()): Workout[] {
  const priorWeek = new Date(now);
  priorWeek.setDate(priorWeek.getDate() - 7);
  const { start, end } = getWeekRange(priorWeek);
  return workouts.filter((w) => isWithinRange(w.date, start, end));
}

export function lifetimeVolume(workouts: Workout[]): number {
  return workouts.reduce((sum, w) => sum + workoutVolume(w), 0);
}

export function avgWorkoutDurationSec(workouts: Workout[]): number {
  const timed = workouts.filter((w) => w.durationSec != null);
  if (timed.length === 0) return 0;
  return timed.reduce((sum, w) => sum + (w.durationSec ?? 0), 0) / timed.length;
}

// Number of consecutive weeks (ending this week or last week) with at least one workout
export function calcStreak(workouts: Workout[], now: Date = new Date()): number {
  if (workouts.length === 0) return 0;
  const weekKeys = new Set(workouts.map((w) => getWeekRange(new Date(w.date + 'T00:00:00')).start));

  let cursor = new Date(now);
  let { start: thisWeekStart } = getWeekRange(cursor);
  // If current week has no workout yet, allow starting the streak count from last week
  if (!weekKeys.has(thisWeekStart)) {
    cursor.setDate(cursor.getDate() - 7);
  }

  let streak = 0;
  while (true) {
    const { start } = getWeekRange(cursor);
    if (weekKeys.has(start)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 7);
    } else {
      break;
    }
  }
  return streak;
}

export function personalRecords(workouts: Workout[]): Record<string, { weight: number; reps: number; date: string }> {
  const prs: Record<string, { weight: number; reps: number; date: string }> = {};
  for (const w of workouts) {
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        const current = prs[ex.exerciseId];
        if (!current || s.weight > current.weight) {
          prs[ex.exerciseId] = { weight: s.weight, reps: s.reps, date: w.date };
        }
      }
    }
  }
  return prs;
}

export interface PRHit { exerciseId: string; exerciseName: string; weight: number; reps: number; date: string }

// Walks workouts in chronological order tracking each exercise's best-so-far,
// and flags every time that best was *broken* on or after `sinceDate` — e.g.
// new PRs hit this week, as opposed to `personalRecords`' all-time snapshot.
export function prsAchievedSince(workouts: Workout[], sinceDate: string): PRHit[] {
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const bestSoFar: Record<string, number> = {};
  const hits: PRHit[] = [];
  for (const w of sorted) {
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        const prevBest = bestSoFar[ex.exerciseId] ?? 0;
        if (s.weight > prevBest) {
          bestSoFar[ex.exerciseId] = s.weight;
          if (w.date >= sinceDate) {
            hits.push({ exerciseId: ex.exerciseId, exerciseName: ex.exerciseName, weight: s.weight, reps: s.reps, date: w.date });
          }
        }
      }
    }
  }
  return hits;
}

export function totalDurationSec(workouts: Workout[]): number {
  return workouts.reduce((sum, w) => sum + (w.durationSec ?? 0), 0);
}

export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function weeklyVolumeSeriesForExercise(workouts: Workout[], exerciseId: string): { week: string; volume: number }[] {
  const byWeek: Record<string, number> = {};
  for (const w of workouts) {
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    const { start } = getWeekRange(new Date(w.date + 'T00:00:00'));
    const vol = ex.sets.reduce((sum, s) => sum + s.reps * s.weight, 0);
    byWeek[start] = (byWeek[start] ?? 0) + vol;
  }
  return Object.entries(byWeek)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, volume]) => ({ week, volume }));
}

// Total volume (every exercise combined) per week — the macro trend, as
// opposed to weeklyVolumeSeriesForExercise's single-exercise view.
export function weeklyVolumeSeries(workouts: Workout[]): { week: string; volume: number }[] {
  const byWeek: Record<string, number> = {};
  for (const w of workouts) {
    const { start } = getWeekRange(new Date(w.date + 'T00:00:00'));
    byWeek[start] = (byWeek[start] ?? 0) + workoutVolume(w);
  }
  return Object.entries(byWeek)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, volume]) => ({ week, volume }));
}

export interface OneRmPoint { date: string; oneRm: number }

// Estimated 1RM (Epley) per workout that touched this exercise, taking the
// best set of that session — the strength trend, as opposed to volume which
// conflates load with how many reps/sets were done.
export function oneRmSeriesForExercise(workouts: Workout[], exerciseId: string): OneRmPoint[] {
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const points: OneRmPoint[] = [];
  for (const w of sorted) {
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex || ex.sets.length === 0) continue;
    const best = Math.max(...ex.sets.map((s) => epley1RM(s.weight, s.reps)));
    points.push({ date: w.date, oneRm: best });
  }
  return points;
}

// N days back from `now` as a date key — used to build timeframe cutoffs
// (e.g. "last 4 weeks") for filtering workouts.
export function dateNDaysAgo(days: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return toDateKey(d);
}

export interface PeriodSummary { volume: number; workouts: number; durationSec: number; calories: number }

export function summarizePeriod(workouts: Workout[], bodyWeightKg = DEFAULT_BODYWEIGHT_KG): PeriodSummary {
  return {
    volume: lifetimeVolume(workouts),
    workouts: workouts.length,
    durationSec: totalDurationSec(workouts),
    calories: workouts.reduce((sum, w) => sum + workoutCalories(w, bodyWeightKg, w.durationSec), 0),
  };
}

// Percent change from `prev` to `curr`, or null when there's no baseline to
// compare against (avoids a meaningless "+Infinity%" or divide-by-zero).
export function percentDelta(curr: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}
