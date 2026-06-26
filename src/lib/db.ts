import { openDB, type IDBPDatabase } from 'idb';
import type { ActiveSession, Exercise, UserSettings, Workout, WorkoutExercise, WorkoutTemplate } from '../types';
import { BUILT_IN_EXERCISES } from './exercises';
import { toDateKey } from './calculations';

const DB_NAME = 'fitness-tracker-db';
const DB_VERSION = 4;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('exercises')) {
          db.createObjectStore('exercises', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('workouts')) {
          const store = db.createObjectStore('workouts', { keyPath: 'id' });
          store.createIndex('date', 'date');
        }
        if (!db.objectStoreNames.contains('activeSession')) {
          db.createObjectStore('activeSession', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function initDb() {
  const db = await getDb();
  const tx = db.transaction('exercises', 'readwrite');
  const count = await tx.store.count();
  if (count === 0) {
    for (const ex of BUILT_IN_EXERCISES) {
      await tx.store.put(ex);
    }
  } else {
    // Backfill exercises (and fields) added to built-ins after a user's first
    // launch — inserts any new built-in records and patches existing ones
    // that are missing newer fields.
    for (const ex of BUILT_IN_EXERCISES) {
      const existing = await tx.store.get(ex.id);
      if (!existing) {
        await tx.store.put(ex);
        continue;
      }
      const patch: Partial<Exercise> = {};
      if (!existing.description && ex.description) patch.description = ex.description;
      if (!existing.overview && ex.overview) patch.overview = ex.overview;
      if (!existing.howTo && ex.howTo) patch.howTo = ex.howTo;
      if (!existing.secondaryMuscles && ex.secondaryMuscles) patch.secondaryMuscles = ex.secondaryMuscles;
      if (Object.keys(patch).length > 0) {
        await tx.store.put({ ...existing, ...patch });
      }
    }
  }
  await tx.done;
  await seedDemoDataOnce();
}

// Demo seed lives in app code (not a one-off browser script) so it ships for
// every visitor's own browser storage, not just whichever machine ran it once
// — IndexedDB never leaves the browser it's written in. Runs exactly once per
// browser (gated on a localStorage flag, not on "workouts is empty") so it
// never comes back after a deliberate Clear Data.
const DEMO_SEED_FLAG = 'evolve_demo_seeded';

async function seedDemoDataOnce(): Promise<void> {
  if (typeof localStorage === 'undefined' || localStorage.getItem(DEMO_SEED_FLAG)) return;
  localStorage.setItem(DEMO_SEED_FLAG, '1');

  const existing = await getAllWorkouts();
  if (existing.length > 0) return; // a real user's data already exists — never overwrite it

  type DemoExercise = [exerciseId: string, name: string, muscleGroup: Exercise['muscleGroup'], reps: number, baseKg: number, isCompound: boolean];
  const PUSH: DemoExercise[] = [
    ['bb-bench-press', 'Barbell Bench Press', 'chest', 5, 60, true],
    ['ohp', 'Overhead Press', 'shoulders', 6, 35, true],
    ['dips', 'Dips', 'triceps', 10, 0, false],
    ['lateral-raise', 'Lateral Raise', 'shoulders', 12, 10, false],
    ['tricep-pushdown', 'Tricep Pushdown', 'triceps', 10, 25, false],
  ];
  const PULL: DemoExercise[] = [
    ['deadlift', 'Deadlift', 'back', 5, 100, true],
    ['bb-row', 'Barbell Row', 'back', 8, 55, true],
    ['lat-pulldown', 'Lat Pulldown', 'back', 10, 50, false],
    ['bb-curl', 'Barbell Curl', 'biceps', 10, 25, false],
    ['face-pull', 'Face Pull', 'back', 12, 20, false],
  ];
  const LEGS: DemoExercise[] = [
    ['back-squat', 'Back Squat', 'quads', 5, 70, true],
    ['romanian-deadlift', 'Romanian Deadlift', 'hamstrings', 8, 60, true],
    ['leg-press', 'Leg Press', 'quads', 10, 90, false],
    ['leg-curl', 'Leg Curl', 'hamstrings', 10, 30, false],
    ['calf-raise', 'Standing Calf Raise', 'calves', 15, 40, false],
  ];
  const DAY_TYPES = [
    { name: 'Push Day', exercises: PUSH, durationSec: 3000 },
    { name: 'Pull Day', exercises: PULL, durationSec: 3300 },
    { name: 'Leg Day', exercises: LEGS, durationSec: 3600 },
  ];

  // Top-set weight as a fraction of base, by week (12 weeks), with a deload
  // around week 6 — so the Stats 1RM chart shows a real progression curve
  // instead of a flat or naively-monotonic line.
  const compoundPct = [1, 1.02, 1.04, 1.06, 1.08, 1.10, 0.95, 1.0, 1.05, 1.08, 1.11, 1.14];
  const accessoryPct = [1, 1.0, 1.03, 1.03, 1.06, 1.06, 0.98, 1.0, 1.03, 1.06, 1.08, 1.10];

  function weightForWeek(base: number, week: number, isCompound: boolean): number {
    if (base === 0) return 0;
    const pct = (isCompound ? compoundPct : accessoryPct)[week];
    const rounding = isCompound ? 2.5 : 1;
    return Math.round((base * pct) / rounding) * rounding;
  }

  function newId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  const today = new Date();
  const dow = today.getDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + diffToMonday);
  thisMonday.setHours(9, 0, 0, 0);
  const startMonday = new Date(thisMonday);
  startMonday.setDate(thisMonday.getDate() - 11 * 7);

  let dayCounter = 0;
  for (let week = 0; week < 12; week++) {
    for (const offset of [0, 2, 4]) {
      const date = new Date(startMonday);
      date.setDate(startMonday.getDate() + week * 7 + offset);
      if (date > today) continue;

      const dayType = DAY_TYPES[dayCounter % 3];
      dayCounter++;

      const exercises: WorkoutExercise[] = dayType.exercises.map(([exerciseId, name, muscleGroup, reps, base, isCompound]) => {
        const weight = weightForWeek(base, week, isCompound);
        const setCount = isCompound ? 4 : 3;
        const sets = Array.from({ length: setCount }, () => ({ id: newId(), reps, weight }));
        return { id: newId(), exerciseId, exerciseName: name, muscleGroup, sets };
      });

      const startedAt = date.getTime();
      const endedAt = startedAt + dayType.durationSec * 1000;
      await saveWorkout({
        id: newId(),
        date: toDateKey(date),
        name: dayType.name,
        exercises,
        createdAt: startedAt,
        startedAt,
        endedAt,
        durationSec: dayType.durationSec,
      });
    }
  }

  await saveSettings({ id: 'profile', bodyWeightKg: 82 });

  for (const dt of DAY_TYPES) {
    await saveTemplate({
      id: newId(),
      name: dt.name,
      createdAt: Date.now(),
      exercises: dt.exercises.map(([exerciseId, name, muscleGroup]) => ({
        id: newId(), exerciseId, exerciseName: name, muscleGroup,
      })),
    });
  }
}

export async function getAllExercises(): Promise<Exercise[]> {
  const db = await getDb();
  return db.getAll('exercises');
}

export async function addExercise(exercise: Exercise): Promise<void> {
  const db = await getDb();
  await db.put('exercises', exercise);
}

export async function getAllWorkouts(): Promise<Workout[]> {
  const db = await getDb();
  const workouts = await db.getAll('workouts');
  return workouts.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export async function saveWorkout(workout: Workout): Promise<void> {
  const db = await getDb();
  await db.put('workouts', workout);
}

export async function deleteWorkout(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('workouts', id);
}

export async function getWorkout(id: string): Promise<Workout | undefined> {
  const db = await getDb();
  return db.get('workouts', id);
}

export async function getActiveSession(): Promise<ActiveSession | undefined> {
  const db = await getDb();
  return db.get('activeSession', 'current');
}

export async function saveActiveSession(session: ActiveSession): Promise<void> {
  const db = await getDb();
  await db.put('activeSession', session);
}

export async function clearActiveSession(): Promise<void> {
  const db = await getDb();
  await db.delete('activeSession', 'current');
}

// Starts (and persists) a fresh timed session — shared by every entry point
// that can kick one off (Live Workout's own Start button, Log Workout's).
export async function startActiveSession(): Promise<ActiveSession> {
  const fresh: ActiveSession = { id: 'current', date: toDateKey(new Date()), startedAt: Date.now(), exercises: [] };
  await saveActiveSession(fresh);
  return fresh;
}

// Converts a finished session into a saved Workout (skipped if no exercises
// were logged) and clears the active session — shared by every entry point
// that can end one. Merges into that day's existing date-logged workout
// (if any) rather than creating a second record for the same date — History
// and the Calendar only ever look up one workout per date, so a stray
// duplicate would silently hide whichever record lost that lookup.
export async function endActiveSession(session: ActiveSession, endedAt: number): Promise<void> {
  if (session.exercises.length > 0) {
    const existing = (await getAllWorkouts()).find((w) => w.date === session.date);
    const sessionDurationSec = Math.round((endedAt - session.startedAt) / 1000);
    if (existing) {
      await saveWorkout({
        ...existing,
        name: existing.name ?? session.name,
        exercises: [...existing.exercises, ...session.exercises],
        startedAt: existing.startedAt ?? session.startedAt,
        endedAt,
        durationSec: (existing.durationSec ?? 0) + sessionDurationSec,
      });
    } else {
      await saveWorkout({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        date: session.date,
        name: session.name,
        exercises: session.exercises,
        createdAt: Date.now(),
        startedAt: session.startedAt,
        endedAt,
        durationSec: sessionDurationSec,
      });
    }
  }
  await clearActiveSession();
}

export async function getSettings(): Promise<UserSettings | undefined> {
  const db = await getDb();
  return db.get('settings', 'profile');
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  const db = await getDb();
  await db.put('settings', settings);
}

export async function getAllTemplates(): Promise<WorkoutTemplate[]> {
  const db = await getDb();
  const templates = await db.getAll('templates');
  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveTemplate(template: WorkoutTemplate): Promise<void> {
  const db = await getDb();
  await db.put('templates', template);
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('templates', id);
}

// Wipes everything the user has entered (workouts, templates, any in-progress
// session, body weight) but leaves the built-in exercise library alone —
// that's reference data, not something to "clear".
export async function clearAllData(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['workouts', 'templates', 'activeSession', 'settings'], 'readwrite');
  await Promise.all([
    tx.objectStore('workouts').clear(),
    tx.objectStore('templates').clear(),
    tx.objectStore('activeSession').clear(),
    tx.objectStore('settings').clear(),
  ]);
  await tx.done;
}
