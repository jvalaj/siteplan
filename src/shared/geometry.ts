import type { Feature, Layout, Wall } from './layout';

export interface Point {
  x: number;
  y: number;
}

const RAD = Math.PI / 180;

/** unit vector for a heading. y grows downward, like the screen. */
export function direction(heading: number): Point {
  // rounding keeps 90-degree turns exact instead of leaving 6e-17 behind.
  const round = (n: number) => Math.round(n * 1e9) / 1e9;
  return { x: round(Math.cos(heading * RAD)), y: round(Math.sin(heading * RAD)) };
}

/** keeps a heading between 0 and 360. */
export function normalizeHeading(heading: number): number {
  return ((heading % 360) + 360) % 360;
}

/**
 * the corners of the outline, starting at (0, 0). there is one more corner than there are walls:
 * the last one is where the last wall ends.
 */
export function corners(walls: Wall[]): Point[] {
  const points: Point[] = [{ x: 0, y: 0 }];
  for (const wall of walls) {
    const last = points[points.length - 1];
    const d = direction(wall.heading);
    points.push({ x: last.x + d.x * wall.lengthMm, y: last.y + d.y * wall.lengthMm });
  }
  return points;
}

/** where a wall starts and ends. */
export function wallEnds(walls: Wall[], wallId: string): { start: Point; end: Point } | undefined {
  const index = walls.findIndex((w) => w.id === wallId);
  if (index < 0) return undefined;
  const points = corners(walls);
  return { start: points[index], end: points[index + 1] };
}

/**
 * how far the end of the last wall is from the first corner. on a real job this is never exactly
 * zero: it is the build-up of small measuring errors, and a big number means a wall was
 * measured wrong or a turn was missed.
 */
export function closingGap(walls: Wall[]): { distanceMm: number; heading: number } {
  const points = corners(walls);
  const end = points[points.length - 1];
  const distanceMm = Math.hypot(end.x, end.y);
  const heading = normalizeHeading(Math.atan2(-end.y, -end.x) / RAD);
  return { distanceMm, heading };
}

/** gaps up to this size are treated as measuring error and the shape is simply closed. */
export const CLOSE_TOLERANCE_MM = 25;

export function perimeterMm(layout: Layout): number {
  return layout.walls.reduce((sum, wall) => sum + wall.lengthMm, 0);
}

/** signed area: positive when the outline runs clockwise on screen. */
function signedAreaMm2(walls: Wall[]): number {
  const points = corners(walls);
  let twice = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    twice += a.x * b.y - b.x * a.y;
  }
  return twice / 2;
}

/** floor area. only meaningful once the outline is closed. */
export function areaMm2(layout: Layout): number {
  return Math.abs(signedAreaMm2(layout.walls));
}

/**
 * unit vector pointing away from the inside of the shape, for a wall with this heading.
 * dimension labels and steps are drawn on that side.
 */
export function outwardNormal(walls: Wall[], heading: number): Point {
  const d = direction(heading);
  // walking clockwise, the inside is on the right, so outside is on the left.
  const clockwise = signedAreaMm2(walls) >= 0;
  return clockwise ? { x: d.y, y: -d.x } : { x: -d.y, y: d.x };
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bounds(points: Point[]): Bounds {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

/** the two ends of a feature along its wall. a post has both ends in the same place. */
export function featureEnds(
  walls: Wall[],
  feature: Feature,
): { start: Point; end: Point } | undefined {
  const wall = walls.find((w) => w.id === feature.wallId);
  const ends = wallEnds(walls, feature.wallId);
  if (!wall || !ends) return undefined;
  const d = direction(wall.heading);
  const at = (mm: number) => ({ x: ends.start.x + d.x * mm, y: ends.start.y + d.y * mm });
  return { start: at(feature.offsetMm), end: at(feature.offsetMm + feature.widthMm) };
}

/** true when a feature runs past the end of its wall, which means a reading is wrong. */
export function featureOverruns(walls: Wall[], feature: Feature): boolean {
  const wall = walls.find((w) => w.id === feature.wallId);
  return !!wall && feature.offsetMm + feature.widthMm > wall.lengthMm + 1;
}
