import { describe, expect, it } from 'vitest';

import { addFeature, addWall, closeShape, remeasureWall, stamp } from '../src/shared/edit';
import { feetInchesToMm, formatArea, formatFeetInches, formatLength } from '../src/shared/format';
import {
  areaMm2,
  closingGap,
  corners,
  featureEnds,
  featureOverruns,
  outwardNormal,
  perimeterMm,
} from '../src/shared/geometry';
import { isNewer, type Layout, newLayout } from '../src/shared/layout';

/** walks a list of [length, turn] pairs, the way dana would. */
function walk(steps: [number, -90 | -45 | 45 | 90][]): Layout {
  let layout = newLayout('room', 'Test', 'Dana');
  for (const [length, turn] of steps) layout = addWall(layout, length, turn, 'tape').layout;
  return layout;
}

const rectangle = () =>
  walk([
    [4000, 90],
    [3000, 90],
    [4000, 90],
    [3000, 90],
  ]);

describe('walking an outline', () => {
  it('puts each corner where the walls lead', () => {
    expect(corners(rectangle().walls)).toEqual([
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: 0, y: 3000 },
      { x: 0, y: 0 },
    ]);
  });

  it('turns left as well as right, and by 45 degrees', () => {
    const left = walk([
      [1000, 90],
      [1000, -90],
    ]);
    expect(corners(left.walls)[2]).toEqual({ x: 0 + 1000, y: -1000 });
    const angled = walk([
      [1000, 90],
      [1000, 45],
    ]);
    const end = corners(angled.walls)[2];
    expect(end.x).toBeCloseTo(1000 + 707.107, 2);
    expect(end.y).toBeCloseTo(707.107, 2);
  });

  it('measures perimeter and area', () => {
    const layout = { ...rectangle(), closed: true };
    expect(perimeterMm(layout)).toBe(14000);
    expect(areaMm2(layout)).toBe(12_000_000);
    expect(formatArea(areaMm2(layout), 'metric')).toBe('12.00 m²');
    expect(formatArea(areaMm2(layout), 'imperial')).toBe('129.2 sq ft');
  });

  it('gives the same area whichever way round the room was walked', () => {
    const anticlockwise = walk([
      [4000, -90],
      [3000, -90],
      [4000, -90],
      [3000, -90],
    ]);
    expect(areaMm2(anticlockwise)).toBe(12_000_000);
  });

  it('knows which side of a wall is outside', () => {
    // walked clockwise, the top wall's outside is up (negative y).
    expect(outwardNormal(rectangle().walls, 0)).toEqual({ x: 0, y: -1 });
  });
});

describe('closing the outline', () => {
  it('reports how far the last corner is from the first', () => {
    const open = walk([
      [4000, 90],
      [3000, 90],
      [3990, 90],
    ]);
    const gap = closingGap(open.walls);
    expect(gap.distanceMm).toBeCloseTo(Math.hypot(10, 3000), 5);
  });

  it('just closes when the gap is small enough to be measuring error', () => {
    const nearly = walk([
      [4000, 90],
      [3000, 90],
      [3995, 90],
      [3004, 90],
    ]);
    const { layout, id } = closeShape(nearly);
    expect(layout.closed).toBe(true);
    expect(id).toBeUndefined();
    expect(layout.walls).toHaveLength(4);
  });

  it('adds a worked-out wall when a whole side is missing', () => {
    const threeSides = walk([
      [4000, 90],
      [3000, 90],
      [4000, 90],
    ]);
    const { layout, id } = closeShape(threeSides);
    const added = layout.walls[3];
    expect(added.id).toBe(id);
    expect(added.source).toBe('computed');
    expect(added.lengthMm).toBe(3000);
    expect(added.heading).toBe(270);
    expect(closingGap(layout.walls).distanceMm).toBeCloseTo(0, 5);
  });

  it('reopens a closed outline if a re-measured wall no longer meets', () => {
    const closed = { ...rectangle(), closed: true };
    const stillFine = remeasureWall(closed, closed.walls[0].id, 4010, 'tape');
    expect(stillFine.closed).toBe(true);
    const broken = remeasureWall(closed, closed.walls[0].id, 4500, 'tape');
    expect(broken.closed).toBe(false);
    expect(broken.walls[0].lengthMm).toBe(4500);
  });
});

describe('features', () => {
  it('places a feature along its wall from the starting corner', () => {
    const base = rectangle();
    const { layout } = addFeature(base, base.walls[1].id, 'door', 500, 900, 'tape');
    expect(featureEnds(layout.walls, layout.features[0])).toEqual({
      start: { x: 4000, y: 500 },
      end: { x: 4000, y: 1400 },
    });
    expect(featureOverruns(layout.walls, layout.features[0])).toBe(false);
  });

  it('flags a feature that runs past the end of its wall', () => {
    const base = rectangle();
    const { layout } = addFeature(base, base.walls[1].id, 'window', 2500, 900, 'tape');
    expect(featureOverruns(layout.walls, layout.features[0])).toBe(true);
  });
});

describe('formatting', () => {
  it('writes feet, inches and sixteenths the way a tape reads', () => {
    expect(formatFeetInches(3048)).toBe(`10' 0"`);
    expect(formatFeetInches(3111.5)).toBe(`10' 2 1/2"`);
    expect(formatFeetInches(12.7)).toBe(`1/2"`);
    // rounds up across a whole foot instead of showing 12 inches.
    expect(formatFeetInches(304.6)).toBe(`1' 0"`);
  });

  it('keeps the fine detail of caliper readings', () => {
    expect(formatLength(12.7, 'imperial', 'caliper')).toBe('0.500"');
    expect(formatLength(12.7, 'metric', 'caliper')).toBe('12.70 mm');
    expect(formatLength(3048, 'metric', 'tape')).toBe('3,048 mm');
  });

  it('turns keypad feet, inches and sixteenths into millimeters', () => {
    expect(feetInchesToMm(10, 2, 8)).toBeCloseTo(3111.5, 5);
  });
});

describe('which copy is newer', () => {
  it('prefers the higher revision, then the later edit', () => {
    const a = rectangle();
    const b = stamp(a, a, 'Dana');
    expect(b.rev).toBe(a.rev + 1);
    expect(isNewer(b, a)).toBe(true);
    expect(isNewer(a, b)).toBe(false);
    expect(isNewer({ ...a, updatedAt: a.updatedAt + 1 }, a)).toBe(true);
    expect(isNewer(a, a)).toBe(false);
  });
});
