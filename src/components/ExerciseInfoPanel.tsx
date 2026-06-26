import MuscleFigure from './MuscleFigure';
import type { Exercise } from '../types';

// Shared "More info" body: the body figure plus an Overview / How to Perform
// breakdown. Falls back to the older unsplit `description` field for any
// exercise saved before that split existed.
export default function ExerciseInfoPanel({ exercise }: { exercise: Exercise }) {
  const { muscleGroup, secondaryMuscles, overview, howTo, description } = exercise;
  const hasSplit = !!(overview || howTo);

  return (
    <div className="exercise-info-panel">
      <MuscleFigure muscleGroup={muscleGroup} secondaryMuscles={secondaryMuscles} />

      {hasSplit ? (
        <>
          {overview && (
            <div className="exercise-info-section">
              <h4 className="exercise-info-heading">Overview</h4>
              <p className="exercise-description">{overview}</p>
            </div>
          )}
          {howTo && (
            <div className="exercise-info-section">
              <h4 className="exercise-info-heading">How to Perform</h4>
              <p className="exercise-description">{howTo}</p>
            </div>
          )}
        </>
      ) : (
        description && <p className="exercise-description">{description}</p>
      )}
    </div>
  );
}
