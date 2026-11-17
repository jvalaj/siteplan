// every change dana can make to a layout, as plain functions: old layout in, new layout out.
// keeping them free of screen code makes them easy to test and easy to undo.

import { closingGap, CLOSE_TOLERANCE_MM, normalizeHeading } from './geometry';
import {
  type Feature,
  type FeatureKind,
  type Layout,
  type Measurement,
  newId,
  type Source,
  type Wall,
} from './layout';

/** how far to turn before the next wall, in degrees. positive is a right turn. */
export type Turn = -90 | -45 | 45 | 90;

export function nextHeading(layout: Layout, turn: Turn): number {
  const last = layout.walls[layout.walls.length - 1];
  return last ? normalizeHeading(last.heading + turn) : 0;
}

export function addWall(layout: Layout, lengthMm: number, turn: Turn, source: Source) {
  const wall: Wall = { id: newId('wall'), lengthMm, heading: nextHeading(layout, turn), source };
  return { layout: { ...layout, walls: [...layout.walls, wall] }, id: wall.id };
}

/** replaces a wall's length, for when dana measures it again. */
export function remeasureWall(layout: Layout, wallId: string, lengthMm: number, source: Source) {
  const walls = layout.walls.map((w) => (w.id === wallId ? { ...w, lengthMm, source } : w));
  // a changed wall can pull the outline apart again. only call it closed if it still meets.
  const closed = layout.closed && closingGap(walls).distanceMm <= CLOSE_TOLERANCE_MM;
  return { ...layout, walls, closed };
}

export function reopen(layout: Layout): Layout {
  return { ...layout, closed: false };
}

/**
 * joins the outline back to the first corner. a small gap is measuring error, so the shape is
 * just marked closed. a large gap means there is one more wall dana hasn't measured, so that
 * wall is worked out from the gap and added, marked as "worked out" until she measures it.
 */
export function closeShape(layout: Layout): { layout: Layout; id?: string } {
  const gap = closingGap(layout.walls);
  if (gap.distanceMm <= CLOSE_TOLERANCE_MM) return { layout: { ...layout, closed: true } };
  const wall: Wall = {
    id: newId('wall'),
    lengthMm: Math.round(gap.distanceMm),
    heading: gap.heading,
    source: 'computed',
  };
  return { layout: { ...layout, walls: [...layout.walls, wall], closed: true }, id: wall.id };
}

export function addFeature(
  layout: Layout,
  wallId: string,
  kind: FeatureKind,
  offsetMm: number,
  widthMm: number,
  source: Source,
) {
  const feature: Feature = { id: newId('feature'), wallId, kind, offsetMm, widthMm, source };
  return { layout: { ...layout, features: [...layout.features, feature] }, id: feature.id };
}

export function removeFeature(layout: Layout, featureId: string): Layout {
  return {
    ...layout,
    features: layout.features.filter((f) => f.id !== featureId),
    measurements: layout.measurements.filter((m) => m.targetId !== featureId),
  };
}

export function addMeasurement(
  layout: Layout,
  targetId: string,
  label: string,
  valueMm: number,
  source: Source,
): Layout {
  const measurement: Measurement = { id: newId('measure'), targetId, label, valueMm, source };
  return { ...layout, measurements: [...layout.measurements, measurement] };
}

/** "Wall 3", or "Door on wall 2": the name used for something everywhere in the app. */
export function describe(layout: Layout, id: string | undefined): string {
  if (!id) return '';
  const wallIndex = layout.walls.findIndex((w) => w.id === id);
  if (wallIndex >= 0) return `Wall ${wallIndex + 1}`;
  const feature = layout.features.find((f) => f.id === id);
  if (feature) {
    const onWall = layout.walls.findIndex((w) => w.id === feature.wallId) + 1;
    const kind = feature.kind[0].toUpperCase() + feature.kind.slice(1);
    return `${kind} on wall ${onWall}`;
  }
  return '';
}

/**
 * stamps an edited layout as the newest version: one revision higher than the copy it
 * replaces, with the time and who did it. `touchedId` is what the edit changed, so the
 * office view can point at it.
 */
export function stamp(next: Layout, replaces: Layout, by: string, touchedId?: string): Layout {
  return { ...next, rev: replaces.rev + 1, updatedAt: Date.now(), updatedBy: by, touchedId };
}
