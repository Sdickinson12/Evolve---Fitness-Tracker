import { useEffect, useRef } from 'react';
import Model, { type IExerciseData, type IMuscleStats } from 'react-body-highlighter';
import type { MuscleGroup } from '../types';
import { MUSCLE_GROUPS } from '../types';
import { MUSCLE_OUTLINE_POINTS } from '../lib/muscleOutlinePoints';
import { MUSCLE_MAP, REVERSE_MAP } from '../lib/muscleMap';
import { heatColor } from '../lib/heatColor';
import FiberOverlay from './FiberOverlay';

interface Props {
  volumes: Record<MuscleGroup, number>;
  threshold: number;
  onSelect?: (mg: MuscleGroup) => void;
  selected?: MuscleGroup | null;
}

const BODY_COLOR = heatColor(0, 1); // untrained grey
const SELECTED_OUTLINE = 'rgb(250, 204, 21)'; // yellow — marks the tapped muscle

function buildData(volumes: Record<MuscleGroup, number>, threshold: number): IExerciseData[] {
  return MUSCLE_GROUPS.flatMap((mg) => {
    const volume = volumes[mg] ?? 0;
    const tier = volume <= 0 ? 0 : volume < threshold ? 1 : 2;
    if (tier === 0) return [];
    return [{ name: mg, muscles: MUSCLE_MAP[mg] as never[], frequency: tier }];
  });
}

const normalizePoints = (points: string) => points.trim().replace(/\s+/g, ' ');

// Reverse lookup: normalized `points` string -> the MuscleGroup it belongs to,
// built once per view from the same extracted coordinate data used for the
// selection outline below.
function buildPointsToMuscle(view: 'anterior' | 'posterior'): Map<string, MuscleGroup> {
  const map = new Map<string, MuscleGroup>();
  for (const [libName, pointsList] of Object.entries(MUSCLE_OUTLINE_POINTS[view])) {
    const mg = REVERSE_MAP[libName];
    if (!mg) continue;
    for (const pts of pointsList) map.set(normalizePoints(pts), mg);
  }
  return map;
}

const POINTS_TO_MUSCLE: Record<'anterior' | 'posterior', Map<string, MuscleGroup>> = {
  anterior: buildPointsToMuscle('anterior'),
  posterior: buildPointsToMuscle('posterior'),
};

// react-body-highlighter renders plain SVG <polygon>s with only an onClick —
// no tabIndex, role, or keyboard handler, so a keyboard/screen-reader user
// can't reach any muscle. This wires up every polygon that maps to a tracked
// muscle (matched by `points`, same technique as the selection outline below)
// and draws the yellow outline on whichever one is currently selected.
function applyInteractivity(
  container: HTMLDivElement | null,
  view: 'anterior' | 'posterior',
  selected: MuscleGroup | null | undefined,
  onSelect: ((mg: MuscleGroup) => void) | undefined
) {
  if (!container) return;
  const pointsToMuscle = POINTS_TO_MUSCLE[view];
  container.querySelectorAll('svg.rbh polygon').forEach((node) => {
    const poly = node as SVGPolygonElement;
    const pts = poly.getAttribute('points');
    const mg = pts ? pointsToMuscle.get(normalizePoints(pts)) : undefined;

    if (mg) {
      poly.setAttribute('tabindex', '0');
      poly.setAttribute('role', 'button');
      poly.setAttribute('aria-label', mg);
      poly.setAttribute('aria-pressed', String(selected === mg));
      poly.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(mg);
        }
      };
    } else {
      poly.removeAttribute('tabindex');
      poly.removeAttribute('role');
      poly.removeAttribute('aria-label');
      poly.removeAttribute('aria-pressed');
      poly.onkeydown = null;
    }

    if (mg && selected === mg) {
      poly.style.stroke = SELECTED_OUTLINE;
      poly.style.strokeWidth = '0.8';
      poly.style.strokeLinejoin = 'round';
    } else {
      poly.style.removeProperty('stroke');
      poly.style.removeProperty('stroke-width');
      poly.style.removeProperty('stroke-linejoin');
    }
  });
}

export default function BodyHeatmap({ volumes, threshold, onSelect, selected }: Props) {
  const data = buildData(volumes, threshold);
  const highlightedColors = [heatColor(1, threshold), heatColor(threshold, threshold)];
  const anteriorRef = useRef<HTMLDivElement>(null);
  const posteriorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyInteractivity(anteriorRef.current, 'anterior', selected, onSelect);
    applyInteractivity(posteriorRef.current, 'posterior', selected, onSelect);
  }, [selected, data, onSelect]);

  const handleClick = ({ muscle }: IMuscleStats) => {
    const mg = REVERSE_MAP[muscle];
    if (mg) onSelect?.(mg);
  };

  return (
    <div className="body-heatmap">
      <div className="body-heatmap-figure">
        <div className="body-heatmap-stage" ref={anteriorRef}>
          <Model
            type="anterior"
            data={data}
            bodyColor={BODY_COLOR}
            highlightedColors={highlightedColors}
            onClick={handleClick}
            style={{ width: '100%', padding: 0 }}
          />
          <FiberOverlay type="anterior" />
        </div>
        <span className="body-heatmap-label">Front</span>
      </div>

      <div className="body-heatmap-figure">
        <div className="body-heatmap-stage" ref={posteriorRef}>
          <Model
            type="posterior"
            data={data}
            bodyColor={BODY_COLOR}
            highlightedColors={highlightedColors}
            onClick={handleClick}
            style={{ width: '100%', padding: 0 }}
          />
          <FiberOverlay type="posterior" />
        </div>
        <span className="body-heatmap-label">Back</span>
      </div>
    </div>
  );
}
