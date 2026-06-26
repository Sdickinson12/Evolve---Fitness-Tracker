// Shared muscle-heat color scale: untrained grey, some volume light violet, well-trained violet
// (the app's brand accent). Selection state (tapping a muscle) is communicated separately via a
// yellow outline/highlight, kept deliberately distinct from this fill scale — see SELECTED_OUTLINE
// in BodyHeatmap.tsx. Used by both the body heatmap figures and the muscle-group cards so they stay in sync.

const GREY: [number, number, number] = [58, 61, 68];
const LIGHT_PURPLE: [number, number, number] = [216, 180, 254];
const PURPLE: [number, number, number] = [168, 85, 247];

function rgbFor(volume: number, threshold: number): [number, number, number] {
  if (volume <= 0) return GREY;
  if (volume < threshold) return LIGHT_PURPLE;
  return PURPLE;
}

export function heatColor(volume: number, threshold: number): string {
  const [r, g, b] = rgbFor(volume, threshold);
  return `rgb(${r}, ${g}, ${b})`;
}

export function heatGlow(volume: number, threshold: number, alpha = 0.5): string {
  const [r, g, b] = rgbFor(volume, threshold);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function heatLabel(volume: number, threshold: number): string {
  if (volume <= 0) return 'Not trained';
  if (volume < threshold) return 'Some volume';
  return 'Well trained';
}
