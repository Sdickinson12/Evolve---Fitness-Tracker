// Shared loading treatment for every page's initial data fetch — replaces a
// bare "Loading…" text node with a branded spinner so the in-between state
// doesn't look unfinished. Pages with a stable layout to fill (e.g. a known
// number of stat tiles) can pass children to render skeleton blocks instead.
export default function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-state">
      <span className="spinner" aria-hidden="true" />
      <span className="text-dim" style={{ fontSize: 13 }}>{label}</span>
    </div>
  );
}
