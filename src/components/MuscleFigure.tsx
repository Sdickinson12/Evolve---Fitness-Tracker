import Model, { type IExerciseData } from 'react-body-highlighter';
import type { MuscleGroup } from '../types';
import { MUSCLE_MAP, viewsForMuscle } from '../lib/muscleMap';
import { heatColor } from '../lib/heatColor';
import FiberOverlay from './FiberOverlay';

const BODY_COLOR = heatColor(0, 1); // untrained grey, same as the dashboard figure
const SECONDARY_COLOR = heatColor(1, 2); // light purple — worked, but not the main target
const PRIMARY_COLOR = heatColor(2, 2); // full purple — the main muscle this exercise targets

// A compact, read-only version of the dashboard's body figure — used in "More info"
// panels to show exactly where a given exercise's muscles sit on the body. The
// primary muscle is shown at full intensity; secondary muscles (worked, but less)
// at the lighter tier — most exercises load more than just their one main muscle.
// Only renders the view(s) (front/back) any of those muscles actually appear in.
export default function MuscleFigure({
  muscleGroup, secondaryMuscles = [],
}: { muscleGroup: MuscleGroup; secondaryMuscles?: MuscleGroup[] }) {
  const allMuscles = [muscleGroup, ...secondaryMuscles];
  const views = [...new Set(allMuscles.flatMap(viewsForMuscle))];

  const data: IExerciseData[] = [
    { name: muscleGroup, muscles: MUSCLE_MAP[muscleGroup] as never[], frequency: 2 },
    ...secondaryMuscles.map((mg) => ({ name: mg, muscles: MUSCLE_MAP[mg] as never[], frequency: 1 })),
  ];

  return (
    <div className="muscle-figure-wrap">
      <div className="muscle-figure">
        {views.map((view) => (
          <div className="muscle-figure-stage body-heatmap-stage" key={view}>
            <Model
              type={view}
              data={data}
              bodyColor={BODY_COLOR}
              highlightedColors={[SECONDARY_COLOR, PRIMARY_COLOR]}
              style={{ width: '100%', padding: 0 }}
            />
            <FiberOverlay type={view} />
          </div>
        ))}
      </div>

      {secondaryMuscles.length > 0 && (
        <div className="muscle-figure-legend">
          <span className="row" style={{ gap: 5, alignItems: 'center' }}>
            <span className="muscle-figure-dot" style={{ background: PRIMARY_COLOR }} />
            Primary
          </span>
          <span className="row" style={{ gap: 5, alignItems: 'center' }}>
            <span className="muscle-figure-dot" style={{ background: SECONDARY_COLOR }} />
            Also worked
          </span>
        </div>
      )}
    </div>
  );
}
