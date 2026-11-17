import { ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { KeyRow, Pad, T } from '@/components/ui';
import { Space, useTheme } from '@/lib/theme';
import { describe } from '@/shared/edit';
import { formatLength, type Units } from '@/shared/format';
import { type Layout, SOURCE_LABELS } from '@/shared/layout';

/**
 * every wall as a row of keys: its number, its length, how it was measured. on a big screen
 * there's room for it beside the plan. marcus copies it into a cut list; dana taps a row to
 * measure that wall again. the chosen wall is latched down in yellow, like any key.
 */
export function WallList({
  layout,
  units,
  selectedWallId,
  onSelect,
  empty = 'No walls yet',
}: {
  layout: Layout;
  units: Units;
  selectedWallId?: string;
  onSelect: (id: string | undefined) => void;
  /** what to say before the first wall. */
  empty?: string;
}) {
  const theme = useTheme();
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
      {layout.walls.length === 0 ? (
        // before the first wall, this space says how to start, with a picture of the tape.
        <View style={[styles.empty, { backgroundColor: theme.keyLight, borderColor: theme.seam }]}>
          <Icon name="tape" size={56} color="keyInk" />
          <T variant="title3" color="keyInk" style={styles.emptyText}>
            {empty}
          </T>
        </View>
      ) : (
        <T variant="headline" color="secondary" style={styles.caps}>
          WALLS
        </T>
      )}
      {layout.walls.length ? (
        <Pad>
          {layout.walls.map((w, i) => {
            const on = w.id === selectedWallId;
            const count = layout.features.filter((f) => f.wallId === w.id).length;
            return (
              <KeyRow
                key={w.id}
                selected={on}
                label={`${describe(layout, w.id)}, ${formatLength(w.lengthMm, units, w.source)}`}
                onPress={() => onSelect(on ? undefined : w.id)}>
                {/* the same little key as the number on the plan. */}
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: theme.keyLight, borderColor: theme.seam },
                  ]}>
                  <T variant="headline" color="keyInk">
                    {i + 1}
                  </T>
                </View>
                <T variant="title3" color="keyInk" style={styles.length}>
                  {formatLength(w.lengthMm, units, w.source)}
                </T>
                <T variant="footnote" color={on ? 'keyInk' : 'secondary'} numberOfLines={1}>
                  {SOURCE_LABELS[w.source]}
                  {count ? ` · ${count} ${count === 1 ? 'feature' : 'features'}` : ''}
                </T>
              </KeyRow>
            );
          })}
        </Pad>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  list: { gap: Space.s, paddingTop: Space.s, flexGrow: 1 },
  empty: {
    flex: 1,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.m,
    padding: Space.l,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  emptyText: { textAlign: 'center' },
  caps: { fontWeight: '700', letterSpacing: 0.6 },
  length: { flex: 1, fontVariant: ['tabular-nums'] },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
