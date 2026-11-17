import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import { useDrawIn, useEased, useReduceMotion } from '@/lib/motion';
import { useTheme } from '@/lib/theme';
import { formatLength, type Units } from '@/shared/format';
import {
  bounds,
  closingGap,
  corners,
  direction,
  featureEnds,
  outwardNormal,
  type Point,
} from '@/shared/geometry';
import {
  FEATURE_LABELS,
  FEATURE_LETTERS,
  type Feature,
  type Layout,
  SOURCE_LABELS,
} from '@/shared/layout';

/** the size of a wall's number key, in screen points. */
const BADGE = 30;

// browsers draw svg text in a serif font by default; phones use the system font.
const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : undefined;

/** how the office view is zoomed and moved. zoom 1 with no pan means "fit the whole plan". */
export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
}

export const FIT: Viewport = { zoom: 1, panX: 0, panY: 0 };

type Props = {
  layout: Layout;
  units: Units;
  selectedId?: string;
  /** leave out to make the drawing display-only. */
  onSelect?: (id: string | undefined) => void;
  /** something to point at for a moment, like the wall dana just added. */
  highlightId?: string;
  /** draws a dashed arrow from the open end, showing which way the next wall will go. */
  ghostHeading?: number;
  /** the corner dana measures from, with a marker and arrow so "from the corner" is clear. */
  measureFromWallId?: string;
  /** the wall or feature that was just added. it animates in, so the eye goes straight to it. */
  animateId?: string;
  viewport?: Viewport;
  /** a small preview with no labels. */
  thumbnail?: boolean;
};

/** draws walls, features and lengths; field and office share it so both see the same plan. */
export function LayoutCanvas({
  layout,
  units,
  selectedId,
  onSelect,
  highlightId,
  ghostHeading,
  measureFromWallId,
  animateId,
  viewport = FIT,
  thumbnail,
}: Props) {
  const theme = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { walls } = layout;

  const points = corners(walls);
  const end = points[points.length - 1];
  const reach = bounds(points);
  const span = Math.max(reach.maxX - reach.minX, reach.maxY - reach.minY, 2400);
  const ghostLength = span * 0.28;
  const ghostEnd =
    ghostHeading === undefined || layout.closed
      ? undefined
      : {
          x: end.x + direction(ghostHeading).x * ghostLength,
          y: end.y + direction(ghostHeading).y * ghostLength,
        };

  // fit the outline (and the arrow) inside the view, leaving room around it for labels.
  const fitted = bounds(ghostEnd ? [...points, ghostEnd] : points);
  // labels beside upright walls need more room at the sides than above and below.
  const marginX = thumbnail ? 8 : 96;
  const marginY = thumbnail ? 8 : 56;
  const fitWidth = Math.max(fitted.maxX - fitted.minX, 1200);
  const fitHeight = Math.max(fitted.maxY - fitted.minY, 1200);
  const fitScale = Math.min(
    Math.max(size.width - marginX * 2, 10) / fitWidth,
    Math.max(size.height - marginY * 2, 10) / fitHeight,
  );
  // when the plan grows, glide to the new fit instead of jumping so old walls stay easy to track.
  const moving = !useReduceMotion() && !thumbnail;
  const camera = useEased(
    { scale: fitScale, x: (fitted.minX + fitted.maxX) / 2, y: (fitted.minY + fitted.maxY) / 2 },
    moving && size.width > 0,
  );
  const drawn = useDrawIn(animateId, moving);
  const scale = camera.scale * viewport.zoom;
  const center = { x: camera.x, y: camera.y };
  const at = (p: Point): Point => ({
    x: size.width / 2 + viewport.panX + (p.x - center.x) * scale,
    y: size.height / 2 + viewport.panY + (p.y - center.y) * scale,
  });

  const screen = points.map(at);
  const badgeSpot = (i: number): Point => {
    const out = outwardNormal(walls, walls[i].heading);
    const a = screen[i];
    const b = screen[i + 1];
    return { x: (a.x + b.x) / 2 - out.x * 24, y: (a.y + b.y) / 2 - out.y * 24 };
  };
  // on thin plans opposite wall numbers can overlap, so each slides half a badge along its wall.
  const badges: Point[] = [];
  const alongs: Point[] = [];
  const step = BADGE / 2 + 5;
  for (let i = 0; i < walls.length; i++) {
    let spot = badgeSpot(i);
    const a = screen[i];
    const b = screen[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const along = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    const k = badges.findIndex((o) => Math.hypot(o.x - spot.x, o.y - spot.y) < BADGE + 4);
    if (k >= 0) {
      badges[k] = { x: badges[k].x + alongs[k].x * step, y: badges[k].y + alongs[k].y * step };
      spot = { x: spot.x + along.x * step, y: spot.y + along.y * step };
    }
    badges.push(spot);
    alongs.push(along);
  }
  const badgeAt = (i: number): Point => badges[i];

  // a to-scale grid like graph paper; squares grow as you zoom out so lines never crowd.
  const steps =
    units === 'imperial'
      ? [
          { mm: 304.8, label: '1 ft' },
          { mm: 1524, label: '5 ft' },
          { mm: 3048, label: '10 ft' },
          { mm: 15240, label: '50 ft' },
        ]
      : [
          { mm: 250, label: '250 mm' },
          { mm: 1000, label: '1 m' },
          { mm: 5000, label: '5 m' },
          { mm: 25000, label: '25 m' },
        ];
  const grid = steps.find((step) => step.mm * scale >= 26) ?? steps[steps.length - 1];
  const gridLines: { key: string; x1: number; y1: number; x2: number; y2: number }[] = [];
  if (!thumbnail && size.width > 0 && scale > 0) {
    const spacing = grid.mm * scale;
    const origin = at({ x: 0, y: 0 });
    for (let x = origin.x % spacing; x < size.width; x += spacing) {
      gridLines.push({ key: `v${Math.round(x)}`, x1: x, y1: 0, x2: x, y2: size.height });
    }
    for (let y = origin.y % spacing; y < size.height; y += spacing) {
      gridLines.push({ key: `h${Math.round(y)}`, x1: 0, y1: y, x2: size.width, y2: y });
    }
  }
  const labelSize = 15;
  const featureColor = {
    door: theme.tint,
    window: theme.teal,
    post: theme.orange,
    step: theme.purple,
  };
  const gap = closingGap(walls);

  function text(
    key: string,
    p: Point,
    value: string,
    color: string,
    fontSize = labelSize,
    anchor: 'start' | 'middle' | 'end' = 'middle',
  ) {
    // drawn twice (thick background outline, then letters) so labels stay readable over lines.
    const shared = {
      x: p.x,
      y: p.y + fontSize * 0.35,
      fontSize,
      fontWeight: '700' as const,
      fontFamily: FONT,
      textAnchor: anchor,
    };
    return (
      <G key={key}>
        <SvgText {...shared} stroke={theme.background} strokeWidth={5} strokeLinejoin="round">
          {value}
        </SvgText>
        <SvgText {...shared} fill={color}>
          {value}
        </SvgText>
      </G>
    );
  }

  function drawFeature(feature: Feature) {
    const wall = walls.find((w) => w.id === feature.wallId);
    const ends = featureEnds(walls, feature);
    if (!wall || !ends) return null;
    const a = at(ends.start);
    const b = at(ends.end);
    const out = outwardNormal(walls, wall.heading);
    const color = featureColor[feature.kind];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const selected = feature.id === selectedId || feature.id === highlightId;
    const opacity = feature.id === animateId ? drawn : 1;
    const widthPx = Math.hypot(b.x - a.x, b.y - a.y);
    let shape = null;

    if (feature.kind === 'post') {
      shape = <Rect x={a.x - 7} y={a.y - 7} width={14} height={14} fill={color} />;
    } else if (feature.kind === 'door') {
      // an opening in the wall, the door leaf, and the arc it swings through.
      const leaf = { x: a.x - out.x * widthPx, y: a.y - out.y * widthPx };
      const cross = (leaf.x - a.x) * (b.y - a.y) - (leaf.y - a.y) * (b.x - a.x);
      shape = (
        <G>
          <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={theme.background} strokeWidth={8} />
          <Line x1={a.x} y1={a.y} x2={leaf.x} y2={leaf.y} stroke={color} strokeWidth={3} />
          <Path
            d={`M ${leaf.x} ${leaf.y} A ${widthPx} ${widthPx} 0 0 ${cross > 0 ? 1 : 0} ${b.x} ${b.y}`}
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray={[4, 4]}
            fill="none"
          />
        </G>
      );
    } else if (feature.kind === 'window') {
      // an opening with two thin lines for the glass.
      const o = { x: out.x * 3, y: out.y * 3 };
      shape = (
        <G>
          <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={theme.background} strokeWidth={8} />
          <Line
            x1={a.x + o.x}
            y1={a.y + o.y}
            x2={b.x + o.x}
            y2={b.y + o.y}
            stroke={color}
            strokeWidth={2}
          />
          <Line
            x1={a.x - o.x}
            y1={a.y - o.y}
            x2={b.x - o.x}
            y2={b.y - o.y}
            stroke={color}
            strokeWidth={2}
          />
        </G>
      );
    } else {
      // a step: two treads drawn on the outside of the wall.
      const tread = (n: number) => ({ x: out.x * 9 * n, y: out.y * 9 * n });
      const corner = (p: Point, n: number) => `${p.x + tread(n).x},${p.y + tread(n).y}`;
      shape = (
        <G>
          <Polygon
            points={`${corner(a, 0)} ${corner(b, 0)} ${corner(b, 2)} ${corner(a, 2)}`}
            fill={theme.background}
            stroke={color}
            strokeWidth={2}
          />
          <Line
            x1={a.x + tread(1).x}
            y1={a.y + tread(1).y}
            x2={b.x + tread(1).x}
            y2={b.y + tread(1).y}
            stroke={color}
            strokeWidth={2}
          />
        </G>
      );
    }

    // the letter sits just inside the wall and slides along it if it would hit the number key.
    let letterAt = { x: mid.x - out.x * 18, y: mid.y - out.y * 18 };
    const badge = badgeAt(walls.indexOf(wall));
    const clash = Math.hypot(letterAt.x - badge.x, letterAt.y - badge.y);
    if (clash < BADGE + 4) {
      const along = direction(wall.heading);
      const side = (mid.x - badge.x) * along.x + (mid.y - badge.y) * along.y >= 0 ? 1 : -1;
      letterAt = {
        x: letterAt.x + along.x * side * (BADGE + 8),
        y: letterAt.y + along.y * side * (BADGE + 8),
      };
    }
    return (
      <G key={feature.id} opacity={opacity}>
        {selected ? <Circle cx={mid.x} cy={mid.y} r={24} fill={color} opacity={0.2} /> : null}
        {shape}
        {thumbnail
          ? null
          : text(`${feature.id}-letter`, letterAt, FEATURE_LETTERS[feature.kind], color, 14)}
        {onSelect ? (
          <Circle
            cx={mid.x}
            cy={mid.y}
            r={24}
            fill="#000"
            fillOpacity={0.001}
            onPress={() => onSelect(feature.id)}
          />
        ) : null}
      </G>
    );
  }

  // voiceover can't see the drawing, so each wall gets an invisible button with a description.
  const spoken: { id: string; at: Point; label: string }[] = [];
  if (onSelect && !thumbnail && size.width > 0) {
    walls.forEach((wall, i) => {
      const onWall = layout.features.filter((f) => f.wallId === wall.id);
      const parts = [
        `Wall ${i + 1}`,
        formatLength(wall.lengthMm, units),
        wall.source === 'computed' ? 'not measured yet' : SOURCE_LABELS[wall.source],
      ];
      if (onWall.length)
        parts.push(`${onWall.length} ${onWall.length === 1 ? 'feature' : 'features'}`);
      spoken.push({
        id: wall.id,
        // the invisible button sits on the wall's number key so taps and voiceover match.
        at: badgeAt(i),
        label: parts.join(', '),
      });
    });
    for (const feature of layout.features) {
      const ends = featureEnds(walls, feature);
      if (!ends) continue;
      const a = at(ends.start);
      const b = at(ends.end);
      const wallNumber = walls.findIndex((w) => w.id === feature.wallId) + 1;
      spoken.push({
        id: feature.id,
        at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        label: [
          `${FEATURE_LABELS[feature.kind]} on wall ${wallNumber}`,
          feature.widthMm ? `${formatLength(feature.widthMm, units)} wide` : '',
          `${formatLength(feature.offsetMm, units)} from the corner`,
        ]
          .filter(Boolean)
          .join(', '),
      });
    }
  }

  return (
    <View
      style={styles.fill}
      onLayout={(e) => setSize(e.nativeEvent.layout)}
      accessibilityLabel={`Plan of ${layout.name}, ${walls.length} walls`}>
      {size.width > 0 ? (
        <Svg width={size.width} height={size.height}>
          {onSelect ? (
            <Rect
              width={size.width}
              height={size.height}
              fill="#000"
              fillOpacity={0.001}
              onPress={() => onSelect(undefined)}
            />
          ) : null}

          {gridLines.map((line) => (
            <Line
              key={line.key}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={theme.separator}
              strokeWidth={1}
              opacity={0.6}
            />
          ))}
          {thumbnail ? null : (
            <SvgText
              x={12}
              y={22}
              fontSize={12}
              fontWeight="600"
              fontFamily={FONT}
              fill={theme.secondary}>
              {`1 square = ${grid.label}`}
            </SvgText>
          )}

          {layout.closed && walls.length >= 3 ? (
            <Polygon points={screen.map((p) => `${p.x},${p.y}`).join(' ')} fill={theme.shapeFill} />
          ) : null}

          {/* the gap still to close, so dana can see how far off the outline is. */}
          {!layout.closed && walls.length >= 2 ? (
            <Line
              x1={screen[screen.length - 1].x}
              y1={screen[screen.length - 1].y}
              x2={screen[0].x}
              y2={screen[0].y}
              stroke={theme.red}
              strokeWidth={2}
              strokeDasharray={[3, 7]}
            />
          ) : null}

          {walls.map((wall, i) => {
            const a = screen[i];
            // the newest wall grows out from its starting corner.
            const grow = wall.id === animateId ? drawn : 1;
            const b = {
              x: a.x + (screen[i + 1].x - a.x) * grow,
              y: a.y + (screen[i + 1].y - a.y) * grow,
            };
            const marked = wall.id === selectedId || wall.id === highlightId;
            return (
              <G key={wall.id}>
                {marked ? (
                  <Line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={theme.accent}
                    strokeWidth={16}
                    strokeLinecap="round"
                    opacity={0.45}
                  />
                ) : null}
                <Line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={theme.wall}
                  strokeWidth={thumbnail ? 2.5 : 5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  // a worked-out wall is dashed until someone actually measures it.
                  strokeDasharray={wall.source === 'computed' ? [10, 8] : undefined}
                />
              </G>
            );
          })}

          {layout.features.map(drawFeature)}

          {ghostEnd && !thumbnail ? (
            <G>
              <Line
                x1={at(end).x}
                y1={at(end).y}
                x2={at(ghostEnd).x}
                y2={at(ghostEnd).y}
                stroke={theme.keyDark}
                strokeWidth={4}
                strokeDasharray={[10, 8]}
                strokeLinecap="round"
              />
              <Circle
                cx={at(ghostEnd).x}
                cy={at(ghostEnd).y}
                r={7}
                fill={theme.accent}
                stroke={theme.keyDark}
                strokeWidth={2}
              />
            </G>
          ) : null}

          {thumbnail ? null : (
            <G>
              {(() => {
                const index = walls.findIndex((w) => w.id === measureFromWallId);
                if (index < 0) return null;
                const a = screen[index];
                const b = screen[index + 1];
                const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
                const along = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
                const out = outwardNormal(walls, walls[index].heading);
                // an arrow from the corner along the wall: the way the tape runs.
                const reach = Math.min(56, length * 0.45);
                const tip = { x: a.x + along.x * reach, y: a.y + along.y * reach };
                const head = (turn: number) => ({
                  x: tip.x - along.x * 9 + -along.y * 7 * turn,
                  y: tip.y - along.y * 9 + along.x * 7 * turn,
                });
                const labelAt = {
                  x: a.x - along.x * 30 + out.x * 6,
                  y: a.y - along.y * 30 + out.y * 6,
                };
                return (
                  <G pointerEvents="none">
                    <Circle cx={a.x} cy={a.y} r={16} fill={theme.accent} opacity={0.35} />
                    <Circle
                      cx={a.x}
                      cy={a.y}
                      r={9}
                      fill={theme.accent}
                      stroke={theme.keyDark}
                      strokeWidth={3}
                    />
                    <Line
                      x1={a.x}
                      y1={a.y}
                      x2={tip.x}
                      y2={tip.y}
                      stroke={theme.keyDark}
                      strokeWidth={4}
                      strokeLinecap="round"
                    />
                    <Path
                      d={`M ${head(1).x} ${head(1).y} L ${tip.x} ${tip.y} L ${head(-1).x} ${head(-1).y}`}
                      stroke={theme.keyDark}
                      strokeWidth={4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    {text('measure-from', labelAt, 'tape here', theme.keyDark, 13)}
                  </G>
                );
              })()}

              {/* where the outline starts, and where the next wall will begin. */}
              <Circle cx={screen[0].x} cy={screen[0].y} r={7} fill={theme.wall} />
              {!layout.closed && walls.length > 0 ? (
                <Circle
                  cx={at(end).x}
                  cy={at(end).y}
                  r={8}
                  fill={theme.background}
                  stroke={theme.keyDark}
                  strokeWidth={4}
                />
              ) : null}

              {walls.map((wall, i) => {
                const a = screen[i];
                const b = screen[i + 1];
                const out = outwardNormal(walls, wall.heading);
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                // beside an upright wall the label reads away from it so it never sits on the line.
                const sideways = Math.abs(out.x) > 0.5;
                const lengthAt = sideways
                  ? { x: mid.x + out.x * 14, y: mid.y }
                  : { x: mid.x + out.x * 26, y: mid.y + out.y * 22 };
                const anchor = !sideways ? 'middle' : out.x > 0 ? 'start' : 'end';
                const numberAt = badgeAt(i);
                const on = wall.id === selectedId;
                return (
                  <G key={`${wall.id}-labels`} opacity={wall.id === animateId ? drawn : 1}>
                    {text(
                      `${wall.id}-length`,
                      lengthAt,
                      formatLength(wall.lengthMm, units),
                      theme.label,
                      labelSize,
                      anchor,
                    )}
                    {/* the wall's number is a little key; the chosen one turns yellow. */}
                    <G {...(onSelect ? { onPress: () => onSelect(wall.id) } : {})}>
                      <Rect
                        x={numberAt.x - BADGE / 2}
                        y={numberAt.y - BADGE / 2 + 3}
                        width={BADGE}
                        height={BADGE}
                        rx={8}
                        fill={theme.seam}
                      />
                      <Rect
                        x={numberAt.x - BADGE / 2}
                        y={numberAt.y - BADGE / 2}
                        width={BADGE}
                        height={BADGE}
                        rx={8}
                        fill={on ? theme.accent : theme.keyLight}
                        stroke={theme.seam}
                        strokeWidth={2}
                      />
                      <SvgText
                        x={numberAt.x}
                        y={numberAt.y + 5.5}
                        fontSize={16}
                        fontWeight="800"
                        fontFamily={FONT}
                        textAnchor="middle"
                        fill={theme.keyInk}>
                        {i + 1}
                      </SvgText>
                    </G>
                  </G>
                );
              })}

              {!layout.closed && walls.length >= 2
                ? text(
                    'gap',
                    { x: (screen[0].x + at(end).x) / 2, y: (screen[0].y + at(end).y) / 2 },
                    `gap ${formatLength(gap.distanceMm, units)}`,
                    theme.red,
                    13,
                  )
                : null}
            </G>
          )}

          {/* wide invisible lines on top, so a wall is easy to hit with a gloved finger. */}
          {onSelect
            ? walls.map((wall, i) => (
                <Line
                  key={`${wall.id}-hit`}
                  x1={screen[i].x}
                  y1={screen[i].y}
                  x2={screen[i + 1].x}
                  y2={screen[i + 1].y}
                  stroke="#000"
                  strokeOpacity={0.001}
                  strokeWidth={44}
                  onPress={() => onSelect(wall.id)}
                />
              ))
            : null}
        </Svg>
      ) : null}
      {spoken.map((item) => (
        <Pressable
          key={`spoken-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          accessibilityHint="Selects it"
          accessibilityState={{ selected: item.id === selectedId }}
          onPress={() => onSelect?.(item.id)}
          style={[styles.spoken, { left: item.at.x - 22, top: item.at.y - 22 }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignSelf: 'stretch' },
  spoken: { position: 'absolute', width: 44, height: 44 },
});
