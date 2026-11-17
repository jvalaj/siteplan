import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import { LayoutCanvas } from '@/components/layout-canvas';
import { Icon } from '@/components/icon';
import { KeyRow, Pad, PadRow, T } from '@/components/ui';
import { useSettings } from '@/lib/settings';
import { Space, useTheme } from '@/lib/theme';
import { formatAgo, formatArea } from '@/shared/format';
import { areaMm2 } from '@/shared/geometry';
import { type Layout, SPACE_LABELS } from '@/shared/layout';

/** re-renders every few seconds so "12 s ago" keeps counting. */
export function useNow(everyMs = 5000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

export function LayoutRow({
  layout,
  to,
  compact,
  selected,
  flat,
  onPress,
  style,
}: {
  layout: Layout;
  to: 'field' | 'office';
  /** a smaller thumbnail, for the plan list beside an open plan on an ipad or mac. */
  compact?: boolean;
  selected?: boolean;
  /** a calm card, for the grid on a big screen. */
  flat?: boolean;
  /** replaces opening the plan, e.g. to switch plans in place. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { units } = useSettings();
  const now = useNow();
  const walls = `${layout.walls.length} ${layout.walls.length === 1 ? 'wall' : 'walls'}`;
  const features = layout.features.length
    ? `${layout.features.length} ${layout.features.length === 1 ? 'feature' : 'features'}`
    : '';
  // being worked on right now: the field edited it in the last minute.
  const live = now - layout.updatedAt < 60_000;
  const [kind, time] = layout.name.split(' · ');
  const empty = layout.walls.length === 0;
  return (
    <KeyRow
      label={`${layout.name}, ${layout.closed ? formatArea(areaMm2(layout), units) : 'in progress'}, ${walls}${live ? ', being measured now' : ''}`}
      selected={selected}
      flat={flat}
      style={style}
      onPress={
        onPress ?? (() => router.push({ pathname: `/${to}/[id]`, params: { id: layout.id } }))
      }>
      {/* the thumbnail is a little screen in a navy frame. a plan with no walls yet shows
          the kind of space instead of an empty box. */}
      <View
        style={[
          styles.thumbnail,
          compact && styles.thumbnailCompact,
          { backgroundColor: theme.background, borderColor: flat ? theme.separator : theme.seam },
          flat && styles.thin,
        ]}
        pointerEvents="none">
        {empty ? (
          <View style={styles.emptyThumb}>
            <Icon name={layout.kind} size={compact ? 30 : 40} color="secondary" />
          </View>
        ) : (
          <LayoutCanvas layout={layout} units={units} thumbnail />
        )}
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <T variant="title3" color="keyInk" numberOfLines={1} style={styles.title}>
            {kind ?? SPACE_LABELS[layout.kind]}
          </T>
          {time ? (
            <T
              variant="subhead"
              color={selected ? 'keyInk' : 'accentText'}
              style={styles.time}
              numberOfLines={1}>
              {time}
            </T>
          ) : null}
        </View>
        {/* the number that matters, on a yellow tag like the "next" sticker. a plan that isn't
            closed yet gets a plain grey tag instead. */}
        <View
          style={[
            styles.tag,
            {
              // on a selected (yellow) row, the yellow tag would vanish, so it goes white.
              backgroundColor: layout.closed
                ? selected
                  ? theme.keyLight
                  : theme.accent
                : theme.keyFace,
              borderColor: theme.seam,
            },
            flat && styles.borderless,
          ]}>
          <T variant="headline" color="keyInk" style={styles.tagText} numberOfLines={1}>
            {layout.closed ? formatArea(areaMm2(layout), units) : 'In progress'}
          </T>
        </View>
        <T variant="footnote" color={selected ? 'keyInk' : 'secondary'} numberOfLines={1}>
          {[walls, features].filter(Boolean).join(' · ')} · {layout.updatedBy}{' '}
          {formatAgo(layout.updatedAt, now)}
        </T>
      </View>
      {live ? (
        <View style={[styles.liveTag, { backgroundColor: theme.accent, borderColor: theme.seam }]}>
          <T variant="footnote" color="keyInk" style={styles.liveText}>
            NOW
          </T>
        </View>
      ) : compact ? null : (
        <Icon name="forward" color="secondary" />
      )}
    </KeyRow>
  );
}

/**
 * every plan, as one block of keys. on a phone it's one column. on an ipad or a mac, where one
 * long column wastes most of the screen, it's two.
 */
export function PlanGrid({ layouts, to }: { layouts: Layout[]; to: 'field' | 'office' }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const columns = width >= 1300 ? 3 : width >= 900 ? 2 : 1;
  // on a big screen: separate calm cards with space between them. a long grid of raised keys
  // in dark seams was all lines and shadows. the phone keeps the one-block-of-keys look.
  if (columns > 1) {
    return (
      <View style={styles.grid}>
        {layouts.map((layout) => (
          <LayoutRow
            key={layout.id}
            layout={layout}
            to={to}
            flat
            style={[styles.gridCell, { width: `${100 / columns}%` as const }]}
          />
        ))}
      </View>
    );
  }
  const rows: Layout[][] = [];
  for (let i = 0; i < layouts.length; i += columns) rows.push(layouts.slice(i, i + columns));
  return (
    <Pad>
      {rows.map((row) => (
        <PadRow key={row[0].id}>
          {row.map((layout) => (
            <LayoutRow key={layout.id} layout={layout} to={to} style={styles.cell} />
          ))}
          {/* an odd plan out gets a blank key beside it, so the block stays square. */}
          {row.length < columns ? (
            <View style={[styles.cell, styles.blank, { backgroundColor: theme.keyFace }]} />
          ) : null}
        </PadRow>
      ))}
    </Pad>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1 },
  // each card pads itself half the gap, so the cards line up in even columns.
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, marginHorizontal: -7 },
  gridCell: { paddingHorizontal: 7 },
  thin: { borderWidth: 1 },
  borderless: { borderWidth: 0, paddingVertical: 2 },
  blank: { borderRadius: 10 },
  thumbnail: {
    width: 104,
    height: 96,
    borderRadius: 8,
    borderWidth: 2,
    overflow: 'hidden',
  },
  thumbnailCompact: { width: 76, height: 68 },
  emptyThumb: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 4, alignItems: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: Space.s },
  title: { flexShrink: 1 },
  time: { fontWeight: '600' },
  tag: {
    borderRadius: 6,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  tagText: { fontVariant: ['tabular-nums'] },
  liveTag: { borderRadius: 6, borderWidth: 1.5, paddingHorizontal: 6, paddingVertical: 1 },
  liveText: { fontWeight: '800', letterSpacing: 0.8 },
});
