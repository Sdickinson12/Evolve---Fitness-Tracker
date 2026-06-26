// Faint hand-traced fiber/striation lines, positioned against the body model's own
// 0-100 x / 0-200 y coordinate space (see node_modules/react-body-highlighter's
// bundled polygon data) so they land on top of the right muscle. Decorative only —
// pointer-events are disabled so they never interfere with the clickable polygons
// underneath. Shared by BodyHeatmap and MuscleFigure so both render the same figure.
const FIBER_STROKE = 'rgba(0, 0, 0, 0.38)';

const FIBER_LINES: Record<'anterior' | 'posterior', string> = {
  anterior:
    // pecs fanning from the sternum
    'M52,44 L64,47.5 M52,48.5 L66.5,51.5 M52,53 L63,56.5 ' +
    'M48,44 L36,47.5 M48,48.5 L33.5,51.5 M48,53 L37,56.5 ' +
    // six-pack rows (linea alba center seam comes free from the polygon boundary)
    'M42,75 L58,75 M42,88 L58,88 M43,100 L57,100 ' +
    // bicep belly lines
    'M19.5,53 C21,58 23,63 25.5,67 M80.5,53 C79,58 77,63 74.5,67 ' +
    // quad fan accents (outer heads), calves and forearms already show their own
    // sub-muscle seams once the polygon stroke below is applied
    'M33,98 C31,114 30,130 32,144 M67,98 C69,114 70,130 68,144',
  posterior:
    // trapezius diamond seam
    'M38,30 C45,27 55,27 62,30 M50,22 L50,64 ' +
    // lat V-taper accents
    'M30,55 C34,68 38,78 44,84 M70,55 C66,68 62,78 56,84 ' +
    // glute fold
    'M32,118 C36,121.5 41,122.5 45,121 M68,118 C64,121.5 59,122.5 55,121',
};

export default function FiberOverlay({ type }: { type: 'anterior' | 'posterior' }) {
  return (
    <svg
      className="body-heatmap-fibers"
      viewBox="0 0 100 200"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <path d={FIBER_LINES[type]} fill="none" stroke={FIBER_STROKE} strokeWidth={0.45} strokeLinecap="round" />
    </svg>
  );
}
