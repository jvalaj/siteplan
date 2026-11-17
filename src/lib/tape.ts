// fake bluetooth tape: the on-screen "read tape" button stands in for the real tape's button.

import { closingGap, corners, direction } from '@/shared/geometry';
import type { FeatureKind, Layout, Source } from '@/shared/layout';

export interface Reading {
  valueMm: number;
  source: Source;
}

type Listener = (reading: Reading) => void;
const listeners = new Set<Listener>();

export function onReading(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(reading: Reading) {
  // a real device answers after a short radio delay.
  setTimeout(() => listeners.forEach((l) => l(reading)), 120);
}

const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];
/** real tapes are never dead on: a few millimeters either way. */
const jitter = (mm: number, spread = 3) => Math.round(mm + (Math.random() * 2 - 1) * spread);

const WALL_LENGTHS = [1829, 2438, 3048, 3658, 4267, 4877];

/** a believable next wall length: one that nearly closes the outline, or a common size. */
export function simulateWall(layout: Layout, heading: number) {
  const points = corners(layout.walls);
  const end = points[points.length - 1];
  const d = direction(heading);
  const needed = -(end.x * d.x + end.y * d.y);
  const value = layout.walls.length >= 2 && needed >= 300 ? needed : pick(WALL_LENGTHS);
  emit({ valueMm: jitter(value), source: 'tape' });
}

export function simulateRemeasure(currentMm: number) {
  emit({ valueMm: jitter(currentMm, 6), source: 'tape' });
}

export function simulateClosingWall(layout: Layout) {
  emit({ valueMm: jitter(closingGap(layout.walls).distanceMm, 4), source: 'tape' });
}

export function simulateOffset(wallLengthMm: number, alreadyUsedMm: number) {
  const room = Math.max(300, wallLengthMm - alreadyUsedMm - 1400);
  emit({
    valueMm: jitter(alreadyUsedMm + 300 + Math.random() * Math.min(room, 900)),
    source: 'tape',
  });
}

const WIDTHS: Record<FeatureKind, number[]> = {
  door: [762, 813, 914],
  window: [610, 914, 1219],
  step: [914, 1219],
  post: [0],
};

export function simulateWidth(kind: FeatureKind) {
  emit({ valueMm: jitter(pick(WIDTHS[kind]), 2), source: 'tape' });
}

const EXTRAS: Record<string, number[]> = {
  Height: [2134, 2438, 2743],
  Depth: [305, 610],
  'Sill height': [914, 1067],
  Thickness: [89, 140],
  Rise: [178, 190],
};

export function simulateExtra(label: string, source: Source) {
  if (source === 'caliper') {
    // calipers read to a hundredth of a millimeter.
    emit({ valueMm: Math.round((6 + Math.random() * 80) * 100) / 100, source: 'caliper' });
    return;
  }
  emit({ valueMm: jitter(pick(EXTRAS[label] ?? [1219]), 2), source: 'tape' });
}

/** a number typed on the keypad goes down the same path as a device reading. */
export function typed(valueMm: number) {
  listeners.forEach((l) => l({ valueMm, source: 'typed' }));
}
