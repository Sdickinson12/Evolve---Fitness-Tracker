export type MuscleGroup =
  | 'chest' | 'back' | 'traps' | 'shoulders' | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core';

export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  custom?: boolean;
  // What the exercise targets and why — shown under the "Overview" subheading
  // in "More info". `description` is the older, unsplit field kept only as a
  // fallback for exercises saved before the overview/howTo split.
  description?: string;
  overview?: string;
  // Step-by-step execution — shown under the "How to Perform" subheading.
  howTo?: string;
  // Muscles worked meaningfully less than the primary muscleGroup — e.g. Bench
  // Press is chest-primary but also loads the front delts and triceps. Shown
  // dimmer than the primary muscle in the "More info" body figure.
  secondaryMuscles?: MuscleGroup[];
}

export interface WorkoutSet {
  id: string;
  reps: number;
  weight: number;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  date: string; // YYYY-MM-DD
  exercises: WorkoutExercise[];
  createdAt: number;
  // The routine this workout follows, e.g. "Push Day" — set from the template's
  // name when one is applied. Undefined means it was built ad hoc ("Freestyle").
  name?: string;
  // Only present for workouts logged via a live session (see ActiveSession below).
  startedAt?: number; // epoch ms
  endedAt?: number; // epoch ms
  durationSec?: number; // endedAt - startedAt, locked in when the session ends
}

// The single in-progress, unsaved workout session (if any). Persisted so the
// timer survives a refresh — elapsed time is always recomputed from `startedAt`,
// never stored as a ticking number. Becomes a Workout (with startedAt/endedAt/
// durationSec filled in) once the session ends.
export interface ActiveSession {
  id: 'current';
  date: string; // YYYY-MM-DD, fixed when the session starts
  startedAt: number; // epoch ms
  exercises: WorkoutExercise[];
  name?: string; // set from the template's name when one is applied
}

// A saved, reusable list of exercises (e.g. "Push Day") that a user builds once
// and applies to bulk-add exercises into a workout/session, instead of adding
// each one by hand every time. No sets/reps/weight here — those still get
// logged fresh each time the template is used.
export interface TemplateExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: TemplateExercise[];
  createdAt: number;
}

// Persisted once so calorie estimates (MET × body weight × duration) can be
// personalized instead of relying on a population-average fallback.
export interface UserSettings {
  id: 'profile';
  bodyWeightKg: number;
}

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves', 'core',
];

export const EQUIPMENT_TYPES: Equipment[] = [
  'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight',
];
