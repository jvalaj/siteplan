import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LayoutCanvas } from '@/components/layout-canvas';
import { PlanTitle } from '@/components/plan-title';
import { LayoutRow, useNow } from '@/components/layout-list';
import { WallList } from '@/components/wall-list';
import { Appear, Button, Pad, PadLabel, PadRow, Pill, ScreenIn, T } from '@/components/ui';
import { updateSettings, useSettings } from '@/lib/settings';
import { useShortcuts } from '@/lib/shortcuts';
import { sortedLayouts, useLayout, useSync } from '@/lib/sync';
import { Space, useTheme } from '@/lib/theme';
import { usePanZoom } from '@/lib/use-pan-zoom';
import { describe } from '@/shared/edit';
import { formatAgo, formatArea, formatLength, formatOtherUnit, type Units } from '@/shared/format';
import { areaMm2, closingGap, featureOverruns, perimeterMm } from '@/shared/geometry';
import {
  FEATURE_LABELS,
  type Layout,
  type Source,
  SOURCE_LABELS,
  SPACE_LABELS,
} from '@/shared/layout';

export default function OfficeViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const layout = useLayout(id);
  const { layouts } = useSync();
  const { width } = useWindowDimensions();
  // on a big screen marcus keeps the plan list on the left, like mail, to flip between jobs.
  const sidebar = width >= 1100;
  const viewer = layout ? (
    // a new plan starts fresh: nothing selected, zoomed to fit.
    <Viewer key={layout.id} layout={layout} />
  ) : (
    <View style={styles.missing}>
      <Stack.Screen options={{ title: 'Layout' }} />
      <T color="secondary">This plan was deleted.</T>
    </View>
  );
  if (!sidebar) return <ScreenIn>{viewer}</ScreenIn>;
  return (
    <ScreenIn>
      <View style={styles.wide}>
        <View
          style={[
            styles.sidebar,
            { backgroundColor: theme.grouped, borderColor: theme.separator },
          ]}>
          <ScrollView contentContainerStyle={styles.sidebarList}>
            <T variant="title2">Plans</T>
            <Pad>
              {sortedLayouts(layouts).map((plan) => (
                <LayoutRow
                  key={plan.id}
                  layout={plan}
                  to="office"
                  compact
                  selected={plan.id === id}
                  onPress={() => router.setParams({ id: plan.id })}
                />
              ))}
            </Pad>
          </ScrollView>
        </View>
        <View style={styles.screen}>{viewer}</View>
      </View>
    </ScreenIn>
  );
}

function Viewer({ layout }: { layout: Layout }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { units } = useSettings();
  const { status } = useSync();
  const now = useNow(1000);
  const { width } = useWindowDimensions();
  // on an ipad the inspector sits beside the plan. on a phone it goes underneath.
  const wide = width >= 760;

  const [selectedId, setSelectedId] = useState<string>();
  const { viewport, panHandlers, onLayout, wheelRef, zoomBy, fit } = usePanZoom();
  // when an edit arrives from the field, point at what changed for a few seconds.
  const fresh = now - layout.updatedAt < 5000 ? layout.touchedId : undefined;

  const live = status === 'live';

  // on a mac: + and - zoom, 0 fits the plan.
  useShortcuts({
    '+': () => zoomBy(1.5),
    '=': () => zoomBy(1.5),
    '-': () => zoomBy(1 / 1.5),
    '0': fit,
  });

  return (
    <>
      <View style={[styles.screen, wide && styles.wide, { backgroundColor: theme.background }]}>
        <Stack.Screen
          options={{ title: layout.name, headerTitle: () => <PlanTitle name={layout.name} /> }}
        />
        <View style={styles.canvas} ref={wheelRef} onLayout={onLayout} {...panHandlers}>
          <LayoutCanvas
            layout={layout}
            units={units}
            selectedId={selectedId}
            highlightId={fresh}
            animateId={layout.touchedId}
            onSelect={setSelectedId}
            viewport={viewport}
          />
          <View style={styles.status} pointerEvents="none">
            <Pill
              tone={live ? 'green' : 'secondary'}
              label={`${live ? 'Live' : 'Offline'} · ${layout.updatedBy} ${formatAgo(layout.updatedAt, now)}`}
            />
          </View>
          <Pad style={styles.zoom}>
            {(
              [
                ['Zoom in', 'plus', () => zoomBy(1.5)],
                ['Zoom out', 'minus', () => zoomBy(1 / 1.5)],
                ['Fit plan to screen', 'fit', fit],
              ] as const
            ).map(([label, icon, run]) => (
              <PadRow key={label}>
                <Button
                  cell
                  title=""
                  label={label}
                  icon={icon}
                  iconSize={24}
                  kind="utility"
                  onPress={run}
                />
              </PadRow>
            ))}
          </Pad>
        </View>

        {/* the whole plan fits in one panel: four readouts and keys to step through walls. */}
        <View
          style={[
            wide ? styles.panelWide : styles.panelNarrow,
            { backgroundColor: theme.grouped, borderColor: theme.separator },
            // the home bar needs little room, so tuck the keys closer than the safe area.
            { paddingBottom: Math.max(insets.bottom - 14, Space.s) },
          ]}>
          <Inspector
            layout={layout}
            units={units}
            selectedId={selectedId}
            onSelect={setSelectedId}
            tall={wide}
          />
        </View>
      </View>
    </>
  );
}

type Reading = { label: string; value: string; detail?: string };

/** one readout: small label, big number. the first matters most, so it's orange. */
function Readout({ reading, main }: { reading: Reading; main?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.readout, { backgroundColor: theme.card }]}>
      <T variant="footnote" color="secondary" style={styles.caps} numberOfLines={1}>
        {reading.label.toUpperCase()}
      </T>
      <T
        variant="title2"
        color={main ? 'accentText' : 'label'}
        style={styles.numbers}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {reading.value}
      </T>
      {reading.detail ? (
        <T variant="footnote" color="secondary" style={styles.numbers} numberOfLines={1}>
          {reading.detail}
        </T>
      ) : null}
    </View>
  );
}

function Inspector({
  layout,
  units,
  selectedId,
  onSelect,
  tall,
}: {
  layout: Layout;
  units: Units;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  /** beside the plan there is room for every wall, listed, under the readouts. */
  tall?: boolean;
}) {
  const wall = layout.walls.find((w) => w.id === selectedId);
  const feature = layout.features.find((f) => f.id === selectedId);
  const both = (label: string, mm: number, source?: Source): Reading => ({
    label,
    value: formatLength(mm, units, source),
    detail: formatOtherUnit(mm, units, source),
  });
  const extra = (targetId: string): Reading | undefined => {
    const m = layout.measurements.find((x) => x.targetId === targetId);
    return m ? both(m.label, m.valueMm, m.source) : undefined;
  };

  let title: string;
  let readings: Reading[];
  if (wall) {
    const onWall = layout.features.filter((f) => f.wallId === wall.id);
    title = describe(layout, wall.id);
    readings = [
      both('Length', wall.lengthMm, wall.source),
      {
        label: 'Tool',
        value: SOURCE_LABELS[wall.source],
        detail: wall.source === 'computed' ? 'not measured yet' : undefined,
      },
      {
        label: 'On this wall',
        value: onWall.length ? onWall.map((f) => FEATURE_LABELS[f.kind]).join(', ') : 'Nothing',
      },
      extra(wall.id) ?? { label: 'Extra', value: '—' },
    ];
  } else if (feature) {
    title = describe(layout, feature.id);
    readings = [
      feature.widthMm
        ? both('Width', feature.widthMm, feature.source)
        : { label: 'Width', value: 'Point' },
      both('From corner', feature.offsetMm, feature.source),
      {
        label: 'Tool',
        value: SOURCE_LABELS[feature.source],
        detail: featureOverruns(layout.walls, feature) ? 'too long for its wall' : undefined,
      },
      extra(feature.id) ?? { label: 'Extra', value: '—' },
    ];
  } else {
    // what estimators need for trim or railing: the wall run minus doors, windows and steps.
    const openings = layout.features.reduce((sum, f) => sum + f.widthMm, 0);
    const counts = new Map<string, number>();
    for (const f of layout.features) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
    title = SPACE_LABELS[layout.kind];
    readings = [
      {
        label: 'Area',
        value: layout.closed ? formatArea(areaMm2(layout), units) : 'Open',
        detail: layout.closed
          ? undefined
          : `gap ${formatLength(closingGap(layout.walls).distanceMm, units)}`,
      },
      both('Perimeter', perimeterMm(layout)),
      both('Minus openings', perimeterMm(layout) - openings),
      {
        label: 'Features',
        value: counts.size
          ? [...counts].map(([kind, n]) => `${n} ${kind}${n === 1 ? '' : 's'}`).join(', ')
          : 'None',
      },
    ];
  }

  // the keys step through: the whole plan, then each wall in turn.
  const stops = [undefined, ...layout.walls.map((w) => w.id)];
  const at = Math.max(0, stops.indexOf(wall?.id ?? (feature ? feature.wallId : undefined)));
  const step = (by: 1 | -1) => onSelect(stops[(at + by + stops.length) % stops.length]);
  const toggleUnits = () => updateSettings({ units: units === 'imperial' ? 'metric' : 'imperial' });

  // on a mac: arrows step through walls, esc shows the whole plan, u swaps units.
  useShortcuts({
    ArrowLeft: () => step(-1),
    ArrowUp: () => step(-1),
    ArrowRight: () => step(1),
    ArrowDown: () => step(1),
    Escape: () => onSelect(undefined),
    u: toggleUnits,
  });

  // every wall as a row: what an estimator copies into a cut list, without tapping each one.
  const wallList = tall ? (
    <WallList
      layout={layout}
      units={units}
      selectedWallId={wall?.id ?? feature?.wallId}
      onSelect={onSelect}
    />
  ) : null;

  return (
    <View style={[styles.inspector, tall && styles.inspectorTall]}>
      {/* new numbers fade up into place, so it is clear they changed. */}
      <Appear key={selectedId ?? 'plan'}>
        <Pad>
          <PadRow>
            <Readout reading={readings[0]} main />
            <Readout reading={readings[1]} />
          </PadRow>
          <PadRow>
            <Readout reading={readings[2]} />
            <Readout reading={readings[3]} />
          </PadRow>
        </Pad>
      </Appear>
      <Pad>
        <PadRow>
          <Button
            cell
            title=""
            label="Previous"
            icon="back"
            kind="utility"
            size="field"
            onPress={() => step(-1)}
          />
          <PadLabel wide>
            <T variant="headline" numberOfLines={1}>
              {title}
            </T>
          </PadLabel>
          <Button
            cell
            title=""
            label="Next"
            icon="forward"
            kind="utility"
            size="field"
            onPress={() => step(1)}
          />
          <Button
            cell
            title={units === 'imperial' ? 'ft' : 'mm'}
            label={
              units === 'imperial'
                ? 'Showing feet. Switch to millimeters'
                : 'Showing millimeters. Switch to feet'
            }
            size="field"
            smallTitle
            onPress={toggleUnits}
          />
        </PadRow>
      </Pad>
      {wallList}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  wide: { flexDirection: 'row' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space.xl },
  canvas: { flex: 1, overflow: 'hidden' },
  status: { position: 'absolute', top: Space.m, right: Space.m },
  zoom: { position: 'absolute', right: Space.m, bottom: Space.m, width: 60 },
  panelWide: { width: 420, borderLeftWidth: StyleSheet.hairlineWidth },
  sidebar: { width: 360, borderRightWidth: StyleSheet.hairlineWidth },
  sidebarList: { padding: Space.s, gap: Space.s },
  inspectorTall: { flex: 1 },
  panelNarrow: { borderTopWidth: StyleSheet.hairlineWidth },
  inspector: { padding: Space.s, gap: Space.s },
  readout: {
    flex: 1,
    minHeight: 84,
    justifyContent: 'center',
    paddingHorizontal: Space.m,
    paddingVertical: Space.s,
    borderRadius: 10,
    gap: 1,
  },
  caps: { fontWeight: '700', letterSpacing: 0.6 },
  numbers: { fontVariant: ['tabular-nums'] },
});
