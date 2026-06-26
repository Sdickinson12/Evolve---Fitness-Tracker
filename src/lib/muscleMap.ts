import type { MuscleGroup } from '../types';
import { MUSCLE_OUTLINE_POINTS } from './muscleOutlinePoints';

// Map our MuscleGroup vocabulary onto the body model's anatomical muscle names.
// Front-only and back-only muscles are listed together; each <Model> view simply
// ignores the names that don't appear in its own (anterior/posterior) silhouette.
export const MUSCLE_MAP: Record<MuscleGroup, string[]> = {
  chest: ['chest'],
  back: ['upper-back', 'lower-back'],
  traps: ['trapezius'],
  shoulders: ['front-deltoids', 'back-deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearm'],
  quads: ['quadriceps'],
  hamstrings: ['hamstring'],
  glutes: ['gluteal'],
  calves: ['calves'],
  core: ['abs', 'obliques'],
};

export const REVERSE_MAP: Record<string, MuscleGroup> = Object.fromEntries(
  Object.entries(MUSCLE_MAP).flatMap(([mg, libs]) => libs.map((lib) => [lib, mg as MuscleGroup]))
);

// Which body view(s) a muscle actually appears in, derived from which view's
// outline data contains one of its library names — e.g. shoulders shows in both
// (front-deltoids + back-deltoids), chest only in anterior.
export function viewsForMuscle(mg: MuscleGroup): Array<'anterior' | 'posterior'> {
  const libs = MUSCLE_MAP[mg];
  const views: Array<'anterior' | 'posterior'> = [];
  if (libs.some((lib) => lib in MUSCLE_OUTLINE_POINTS.anterior)) views.push('anterior');
  if (libs.some((lib) => lib in MUSCLE_OUTLINE_POINTS.posterior)) views.push('posterior');
  return views;
}
