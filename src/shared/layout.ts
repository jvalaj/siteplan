// the layout dana edits in the field and marcus reads in the office, stored in millimeters.

export type SpaceKind = 'room' | 'deck' | 'patio';
export type FeatureKind = 'door' | 'window' | 'post' | 'step';

/** where a number came from, so marcus knows how far to trust it. */
export type Source = 'tape' | 'caliper' | 'typed' | 'computed';

/** one straight edge (a wall); `heading` is the way dana walked: 0 is right, 90 is down. */
export interface Wall {
  id: string;
  lengthMm: number;
  heading: number;
  source: Source;
}

/** something on a wall. `offsetMm` is measured from the wall's starting corner. */
export interface Feature {
  id: string;
  wallId: string;
  kind: FeatureKind;
  offsetMm: number;
  /** 0 for a post, which is a point rather than a span. */
  widthMm: number;
  source: Source;
}

/** an extra measurement pinned to a wall or a feature, like a ceiling height or a sill height. */
export interface Measurement {
  id: string;
  targetId: string;
  label: string;
  valueMm: number;
  source: Source;
}

export interface Layout {
  id: string;
  name: string;
  kind: SpaceKind;
  walls: Wall[];
  /** true once the outline has been joined back to its first corner. */
  closed: boolean;
  features: Feature[];
  measurements: Measurement[];
  /** goes up by one on every edit. the copy with the higher number is the newer one. */
  rev: number;
  updatedAt: number;
  updatedBy: string;
  /** the wall or feature the last edit touched, so the office view can point at it. */
  touchedId?: string;
}

export const SPACE_LABELS: Record<SpaceKind, string> = {
  room: 'Room',
  deck: 'Deck',
  patio: 'Patio',
};

export const FEATURE_LABELS: Record<FeatureKind, string> = {
  door: 'Door',
  window: 'Window',
  post: 'Post',
  step: 'Step',
};

/** one letter per feature, drawn on the plan so features never rely on color alone. */
export const FEATURE_LETTERS: Record<FeatureKind, string> = {
  door: 'D',
  window: 'W',
  post: 'P',
  step: 'S',
};

export const SOURCE_LABELS: Record<Source, string> = {
  tape: 'Tape',
  caliper: 'Calipers',
  typed: 'Typed in',
  computed: 'Worked out',
};

/** suggested labels for extra measurements, so dana rarely has to type. */
export const MEASUREMENT_PRESETS = ['Height', 'Depth', 'Sill height', 'Thickness', 'Rise'];

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.floor(
    Math.random() * 1296,
  ).toString(36)}`;
}

export function newLayout(kind: SpaceKind, name: string, by: string): Layout {
  return {
    id: newId('layout'),
    name,
    kind,
    walls: [],
    closed: false,
    features: [],
    measurements: [],
    rev: 1,
    updatedAt: Date.now(),
    updatedBy: by,
  };
}

/** higher revision wins. on a tie, the later edit wins. */
export function isNewer(a: Layout, b: Layout): boolean {
  return a.rev > b.rev || (a.rev === b.rev && a.updatedAt > b.updatedAt);
}

/** messages on the live connection. */
export type ClientMessage =
  { type: 'put'; layout: Layout } | { type: 'delete'; id: string } | { type: 'ping' };

export type ServerMessage =
  /** every layout the server has. sent when a device connects. */
  | { type: 'snapshot'; layouts: Layout[] }
  /** one layout changed. */
  | { type: 'layout'; layout: Layout }
  | { type: 'deleted'; id: string }
  | { type: 'pong' };
