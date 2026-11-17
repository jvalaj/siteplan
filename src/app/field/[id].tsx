import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Alert,
  LayoutAnimation,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Keypad } from '@/components/keypad';
import { LayoutCanvas } from '@/components/layout-canvas';
import { PlanTitle } from '@/components/plan-title';
import { MenuButton } from '@/components/menu';
import { SyncPill } from '@/components/sync-pill';
import { WallList } from '@/components/wall-list';
import type { IconName } from '@/components/icon';
import { Appear, Button, Pad, PadLabel, PadRow, ScreenIn, T, Toast } from '@/components/ui';
import { feedback } from '@/lib/feedback';
import { useReduceMotion } from '@/lib/motion';
import { usePanZoom } from '@/lib/use-pan-zoom';
import { useSettings } from '@/lib/settings';
import { deleteLayout, saveLayout, useLayout } from '@/lib/sync';
import * as tape from '@/lib/tape';
import { headerKeys } from '@/lib/header';
import { useShortcuts } from '@/lib/shortcuts';
import { ColorSchemeOverride, Space, useTheme } from '@/lib/theme';
import {
  addFeature,
  addMeasurement,
  addWall,
  closeShape,
  describe,
  nextHeading,
  remeasureWall,
  removeFeature,
  removeWall,
  reopen,
  stamp,
  type Turn,
} from '@/shared/edit';
import { formatArea, formatLength } from '@/shared/format';
import { areaMm2, closingGap, CLOSE_TOLERANCE_MM, featureOverruns } from '@/shared/geometry';
import {
  FEATURE_LABELS,
  type FeatureKind,
  type Layout,
  MEASUREMENT_PRESETS,
  type Source,
} from '@/shared/layout';

type Mode = 'walls' | 'features' | 'measure';

/** what the next reading from the tape will be used for. */
type Armed =
  | { kind: 'wall'; text: string }
  | { kind: 'remeasure'; wallId: string; text: string }
  | { kind: 'offset'; wallId: string; text: string }
  | { kind: 'width'; wallId: string; text: string }
  | { kind: 'extra'; targetId: string; text: string }
  | { kind: 'none'; text: string };

const FEATURE_KINDS: FeatureKind[] = ['door', 'window', 'post', 'step'];

/** keeps the screen on while the editor is open: dana's hands are busy with the tape. */
function KeepAwake() {
  useKeepAwake();
  return null;
}

export default function FieldEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const layout = useLayout(id);
  if (!layout) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ title: 'Layout' }} />
        <T color="secondary">This layout is no longer here.</T>
      </View>
    );
  }
  // always light in the field since dark mode is hard to read in sun; the office follows system.
  return (
    <ColorSchemeOverride value="light">
      <Editor layout={layout} />
    </ColorSchemeOverride>
  );
}

function Editor({ layout }: { layout: Layout }) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { units } = useSettings();
  const { width, height } = useWindowDimensions();
  // on a tablet held sideways the controls sit beside the plan instead of under it.
  const sideBySide = width >= 760 && width > height;

  const [mode, setMode] = useState<Mode>('walls');
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [angle, setAngle] = useState<90 | 45>(90);
  const [selectedId, setSelectedId] = useState<string>();
  const [featureKind, setFeatureKind] = useState<FeatureKind>('door');
  const [offset, setOffset] = useState<number>();
  const [label, setLabel] = useState(MEASUREMENT_PRESETS[0]);
  const [device, setDevice] = useState<Source>('tape');
  const [history, setHistory] = useState<{ label: string; layout: Layout }[]>([]);
  const [keypad, setKeypad] = useState(false);
  const [folded, setFolded] = useState(false);
  const reduceMotion = useReduceMotion();
  // pinch to zoom, drag to move; a new wall zooms back out so dana sees where it went.
  const { viewport, panHandlers, onLayout, wheelRef, fit, zoomBy } = usePanZoom();
  const zoomed = viewport.zoom !== 1 || viewport.panX !== 0 || viewport.panY !== 0;
  const wallCount = layout.walls.length;
  useEffect(() => {
    fit();
  }, [wallCount, fit]);
  // the keys slide away (and back) instead of vanishing, so it is clear where they went.
  function toggleFold() {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFolded(!folded);
  }
  // the last thing that happened. it is shown as a notification that drops in and leaves.
  const [result, setResultState] = useState<{
    text: string;
    tone: 'green' | 'orange';
    id: number;
  }>();
  const setResult = (next: { text: string; tone: 'green' | 'orange' }) =>
    setResultState((last) => ({ ...next, id: (last?.id ?? 0) + 1 }));

  const turn = ((side === 'right' ? 1 : -1) * angle) as Turn;
  const { walls } = layout;
  const selectedWall = walls.find((w) => w.id === selectedId);
  const selectedFeature = layout.features.find((f) => f.id === selectedId);
  // features need a wall; default to the newest, which is usually where dana is standing.
  const wallInFocus =
    selectedWall ?? walls.find((w) => w.id === selectedFeature?.wallId) ?? walls[walls.length - 1];

  let armed: Armed;
  if (mode === 'walls') {
    if (selectedWall) {
      armed = {
        kind: 'remeasure',
        wallId: selectedWall.id,
        text: `Measure ${describe(layout, selectedWall.id).toLowerCase()} again`,
      };
    } else if (layout.closed) {
      armed = { kind: 'none', text: 'Closed. Tap a wall to fix it.' };
    } else if (walls.length === 0) {
      armed = { kind: 'wall', text: 'Wall 1' };
    } else {
      armed = {
        kind: 'wall',
        text: `Wall ${walls.length + 1} · turn ${side}${angle === 45 ? ' 45°' : ''}`,
      };
    }
  } else if (!wallInFocus) {
    armed = { kind: 'none', text: 'Add a wall first. Tap Walls, then Read.' };
  } else if (mode === 'features') {
    const what = FEATURE_LABELS[featureKind];
    armed =
      offset === undefined
        ? { kind: 'offset', wallId: wallInFocus.id, text: `${what} · 1 of 2 · distance from yellow corner` }
        : { kind: 'width', wallId: wallInFocus.id, text: `${what} · 2 of 2 · how wide` };
  } else {
    const targetId = selectedFeature?.id ?? wallInFocus.id;
    armed = {
      kind: 'extra',
      targetId,
      text: `${label} · ${describe(layout, targetId).toLowerCase()}`,
    };
  }

  /** saves an edit, remembers how to undo it, and says what happened. */
  function commit(
    next: Layout,
    what: string,
    touchedId?: string,
    tone: 'green' | 'orange' = 'green',
  ) {
    setHistory((h) => [...h, { label: what, layout }]);
    saveLayout(stamp(next, layout, 'Dana', touchedId));
    setResult({ text: what, tone });
    if (tone === 'green') feedback.done();
    else feedback.oops();
  }

  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory(history.slice(0, -1));
    setOffset(undefined);
    setSelectedId(undefined);
    saveLayout(stamp(last.layout, layout, 'Dana'));
    // say what was undone, so a stray tap on a wet screen is easy to spot.
    setResult({ text: `Undone · ${last.label}`, tone: 'orange' });
  }

  /** a reading arrived, from the tape, the calipers or the keypad. use it for whatever is armed. */
  function apply({ valueMm, source }: tape.Reading) {
    const shown = formatLength(valueMm, units, source);
    if (armed.kind === 'wall') {
      const added = addWall(layout, valueMm, turn, source);
      const number = added.layout.walls.length;
      // if that wall brought the outline back to the start, close it without being asked.
      const meets = number >= 3 && closingGap(added.layout.walls).distanceMm <= CLOSE_TOLERANCE_MM;
      commit(
        meets ? { ...added.layout, closed: true } : added.layout,
        meets ? `Wall ${number} · ${shown} · closed` : `Wall ${number} · ${shown}`,
        added.id,
      );
    } else if (armed.kind === 'remeasure') {
      commit(
        remeasureWall(layout, armed.wallId, valueMm, source),
        `${describe(layout, armed.wallId)} · ${shown}`,
        armed.wallId,
      );
      setSelectedId(undefined);
    } else if (armed.kind === 'offset') {
      if (featureKind === 'post') finishFeature(armed.wallId, valueMm, 0, source);
      else {
        setOffset(valueMm);
        setResult({ text: `${shown} from the corner`, tone: 'green' });
        feedback.done();
        // typed the distance, so ask for the width straight away.
        if (source === 'typed') setKeypad(true);
      }
    } else if (armed.kind === 'width') {
      finishFeature(armed.wallId, offset ?? 0, valueMm, source);
    } else if (armed.kind === 'extra') {
      commit(
        addMeasurement(layout, armed.targetId, label, valueMm, source),
        `${label} · ${shown}`,
        armed.targetId,
      );
    }
  }

  function finishFeature(wallId: string, offsetMm: number, widthMm: number, source: Source) {
    const added = addFeature(layout, wallId, featureKind, offsetMm, widthMm, source);
    const feature = added.layout.features[added.layout.features.length - 1];
    setOffset(undefined);
    if (featureOverruns(added.layout.walls, feature)) {
      commit(
        added.layout,
        `${FEATURE_LABELS[featureKind]} is too long for this wall`,
        added.id,
        'orange',
      );
    } else {
      commit(added.layout, `${FEATURE_LABELS[featureKind]} added`, added.id);
    }
  }

  // listen for readings; re-subscribing each render keeps `apply` up to date.
  useEffect(() => tape.onReading(apply));

  /** the on-screen stand-in for the button on dana's tape. */
  function readDevice() {
    if (armed.kind === 'wall') tape.simulateWall(layout, nextHeading(layout, turn));
    else if (armed.kind === 'remeasure') tape.simulateRemeasure(selectedWall?.lengthMm ?? 2438);
    else if (armed.kind === 'offset') {
      const used = layout.features
        .filter((f) => f.wallId === armed.wallId)
        .reduce((most, f) => Math.max(most, f.offsetMm + f.widthMm), 0);
      tape.simulateOffset(wallInFocus?.lengthMm ?? 3000, used);
    } else if (armed.kind === 'width') tape.simulateWidth(featureKind);
    else if (armed.kind === 'extra') tape.simulateExtra(label, device);
  }

  function stepWall(by: 1 | -1) {
    if (walls.length === 0) return;
    const index = wallInFocus ? walls.indexOf(wallInFocus) : 0;
    setSelectedId(walls[(index + by + walls.length) % walls.length].id);
    setOffset(undefined);
  }

  // deleting a plan can't be undone, so it lives in the "…" menu and asks first.
  function deletePlan() {
    const run = () => {
      deleteLayout(layout.id);
      router.back();
    };
    const question = `Delete "${layout.name}"?`;
    const detail = "The office loses it too. This can't be undone.";
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`${question}\n${detail}`)) run();
      return;
    }
    Alert.alert(question, detail, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  }

  // plans get a default name with the time so dana never has to type, and can rename later.
  function renamePlan() {
    const [kind, time] = layout.name.split(' · ');
    const save = (text?: string) => {
      const name = text?.trim();
      if (!name || name === kind) return;
      commit({ ...layout, name: time ? `${name} · ${time}` : name }, `Renamed · ${name}`);
    };
    if (Platform.OS === 'web') save(globalThis.prompt?.('Name this plan', kind) ?? undefined);
    else Alert.prompt('Name this plan', undefined, save, 'plain-text', kind);
  }

  function pickMode(next: Mode) {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMode(next);
    setOffset(undefined);
  }

  // keyboard shortcuts on a mac; they pause while the keypad is open.
  useShortcuts(
    {
      r: () => armed.kind !== 'none' && readDevice(),
      t: () => armed.kind !== 'none' && setKeypad(true),
      'mod+z': undo,
      u: undo,
      '1': () => pickMode('walls'),
      '2': () => pickMode('features'),
      '3': () => pickMode('measure'),
      ArrowLeft: () => (mode === 'walls' ? setSide('left') : stepWall(-1)),
      ArrowRight: () => (mode === 'walls' ? setSide('right') : stepWall(1)),
      f: toggleFold,
      '+': () => zoomBy(1.5),
      '=': () => zoomBy(1.5),
      '-': () => zoomBy(1 / 1.5),
      '0': fit,
      Escape: () => {
        setSelectedId(undefined);
        setOffset(undefined);
      },
    },
    !keypad,
  );

  const MODES: { value: Mode; label: string; icon: IconName }[] = [
    { value: 'walls', label: 'Walls', icon: 'walls' },
    { value: 'features', label: 'Add', icon: 'door' },
    { value: 'measure', label: 'Size', icon: 'measure' },
  ];

  // which wall the next feature or measurement goes on, with a key either side to change it.
  const wallPicker = (
    <PadRow>
      <Button
        cell
        title=""
        label="Previous wall"
        kind="utility"
        icon="back"
        size="field"
        onPress={() => stepWall(-1)}
      />
      <PadLabel>
        <T variant="headline">{wallInFocus ? describe(layout, wallInFocus.id) : 'No walls'}</T>
        {wallInFocus ? (
          <T variant="footnote" color="secondary">
            {formatLength(wallInFocus.lengthMm, units)}
          </T>
        ) : null}
      </PadLabel>
      <Button
        cell
        title=""
        label="Next wall"
        kind="utility"
        icon="forward"
        size="field"
        onPress={() => stepWall(1)}
      />
    </PadRow>
  );

  const controls = (
    <View
      style={[
        styles.controls,
        sideBySide && styles.controlsDocked,
        { paddingBottom: Math.max(insets.bottom, Space.s) },
      ]}>
      {/* every control lives in one block of keys with no gaps, like a remote. */}
      <Pad>
        {folded && !sideBySide ? null : (
          <>
            <PadRow>
              {MODES.map((option) => (
                <Button
                  key={option.value}
                  cell
                  stacked
                  title={option.label}
                  icon={option.icon}
                  size="field"
                  kind={mode === option.value ? 'selected' : 'secondary'}
                  onPress={() => pickMode(option.value)}
                />
              ))}
            </PadRow>

            {/* the keys for the chosen mode fade in, so the switch is clear. */}
            <Appear
              key={`${mode}-${selectedWall ? 'wall' : ''}-${layout.closed}`}
              style={styles.modeRows}>
              {mode === 'walls' && selectedWall ? (
                <PadRow>
                  <PadLabel wide>
                    <T variant="headline">{describe(layout, selectedWall.id)}</T>
                    <T variant="footnote" color="secondary">
                      {formatLength(selectedWall.lengthMm, units)}
                    </T>
                  </PadLabel>
                  <Button
                    cell
                    title="Done"
                    size="primary"
                    smallTitle
                    onPress={() => setSelectedId(undefined)}
                  />
                </PadRow>
              ) : null}

              {mode === 'walls' && !selectedWall && layout.closed ? (
                <PadRow>
                  <PadLabel wide>
                    <T variant="headline">{formatArea(areaMm2(layout), units)}</T>
                    <T variant="footnote" color="secondary">
                      {walls.length} walls
                    </T>
                  </PadLabel>
                  <Button
                    cell
                    title="Reopen"
                    size="primary"
                    smallTitle
                    onPress={() => commit(reopen(layout), 'Reopened', undefined, 'orange')}
                  />
                </PadRow>
              ) : null}

              {mode === 'walls' && !selectedWall && !layout.closed ? (
                walls.length === 0 ? (
                  // beside the plan, the walls panel already says this, bigger.
                  sideBySide ? null : (
                    <PadRow>
                      <PadLabel>
                        <T color="secondary">Hook the tape on a corner. Measure the first wall.</T>
                      </PadLabel>
                    </PadRow>
                  )
                ) : (
                  <PadRow>
                    <Button
                      cell
                      stacked
                      title="Left"
                      icon="left"
                      size="primary"
                      kind={side === 'left' ? 'selected' : 'secondary'}
                      onPress={() => setSide('left')}
                    />
                    <Button
                      cell
                      stacked
                      title="Right"
                      icon="right"
                      size="primary"
                      kind={side === 'right' ? 'selected' : 'secondary'}
                      onPress={() => setSide('right')}
                    />
                    <Button
                      cell
                      stacked
                      title={angle === 90 ? '90°' : '45°'}
                      detail="corner"
                      size="primary"
                      onPress={() => setAngle(angle === 90 ? 45 : 90)}
                    />
                  </PadRow>
                )
              ) : null}

              {mode === 'walls' && !selectedWall && !layout.closed && walls.length >= 2 ? (
                <PadRow>
                  <Button
                    cell
                    title="Close shape"
                    icon="close"
                    size="field"
                    onPress={() => {
                      const closed = closeShape(layout);
                      commit(
                        closed.layout,
                        closed.id ? 'Closed. Measure the dashed wall.' : 'Closed',
                        closed.id,
                      );
                    }}
                  />
                </PadRow>
              ) : null}

              {mode === 'features' ? (
                <>
                  {wallPicker}
                  {/* four kinds, as a two-by-two block of equal keys. */}
                  {[FEATURE_KINDS.slice(0, 2), FEATURE_KINDS.slice(2)].map((pair) => (
                    <PadRow key={pair.join()}>
                      {pair.map((kind) => (
                        <Button
                          key={kind}
                          cell
                          title={FEATURE_LABELS[kind]}
                          icon={kind}
                          size="field"
                          kind={featureKind === kind ? 'selected' : 'secondary'}
                          onPress={() => {
                            setFeatureKind(kind);
                            setOffset(undefined);
                            // no tape on the phone yet, so open the keypad for the distance.
                            if (wallInFocus) setKeypad(true);
                          }}
                        />
                      ))}
                    </PadRow>
                  ))}
                </>
              ) : null}

              {mode === 'measure' ? (
                <>
                  {wallPicker}
                  {[MEASUREMENT_PRESETS.slice(0, 4)].map((row) => (
                    <PadRow key={row.join()}>
                      {row.map((preset) => (
                        <Button
                          key={preset}
                          cell
                          title={preset}
                          size="field"
                          smallTitle
                          kind={label === preset ? 'selected' : 'secondary'}
                          onPress={() => setLabel(preset)}
                        />
                      ))}
                    </PadRow>
                  ))}
                  <PadRow>
                    <Button
                      cell
                      title="Tape"
                      icon="tape"
                      size="field"
                      smallTitle
                      kind={device === 'caliper' ? 'secondary' : 'selected'}
                      onPress={() => setDevice('tape')}
                    />
                    <Button
                      cell
                      title="Calipers"
                      icon="caliper"
                      size="field"
                      smallTitle
                      kind={device === 'caliper' ? 'selected' : 'secondary'}
                      onPress={() => setDevice('caliper')}
                    />
                  </PadRow>
                </>
              ) : null}
            </Appear>
          </>
        )}

        <PadRow>
          {selectedFeature || selectedWall ? (
            <Button
              cell
              stacked
              title="Remove"
              icon="trash"
              kind="destructive"
              size="primary"
              onPress={() => {
                const what = describe(layout, selectedId);
                commit(
                  selectedFeature
                    ? removeFeature(layout, selectedFeature.id)
                    : removeWall(layout, selectedWall!.id),
                  `${what} removed`,
                  undefined,
                  'orange',
                );
                setSelectedId(undefined);
              }}
            />
          ) : (
            <Button
              cell
              stacked
              title="Undo"
              kind="utility"
              icon="undo"
              size="primary"
              disabled={history.length === 0}
              onPress={undo}
            />
          )}
          <Button
            cell
            stacked
            title="Type"
            kind="utility"
            icon="keypad"
            size="primary"
            disabled={armed.kind === 'none'}
            onPress={() => setKeypad(true)}
          />
          <Button
            cell
            stacked
            title="Read"
            icon={mode === 'measure' && device === 'caliper' ? 'caliper' : 'tape'}
            // on a mac, show the shortcut on the key itself.
            detail={Platform.OS === 'web' ? 'simulated · R' : 'simulated'}
            kind="primary"
            size="primary"
            disabled={armed.kind === 'none'}
            onPress={() => {
              readDevice();
            }}
          />
        </PadRow>
      </Pad>
    </View>
  );

  // shows what the next tape press will do; on the plan on phones, atop the panel on big screens.
  // doors and sizes need a wall to sit on, so warn instead of showing a next step.
  const needsWall = armed.kind === 'none' && walls.length === 0;
  const nextBar = (
    <View
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      style={[
        styles.next,
        sideBySide && styles.nextDocked,
        { backgroundColor: needsWall ? theme.red : theme.keyDark, borderColor: theme.seam },
      ]}>
      {/* "next" is a little yellow sticker stuck over the top edge; "!" when something must come first. */}
      <View style={[styles.sticker, { backgroundColor: theme.accent, borderColor: theme.seam }]}>
        <T variant="footnote" color="keyInk" style={styles.stickerText}>
          {needsWall ? '  !  ' : 'NEXT'}
        </T>
      </View>
      <T
        variant={sideBySide ? 'title2' : 'title3'}
        color={needsWall ? 'onRed' : 'onDark'}
        numberOfLines={2}
        style={styles.nextText}>
        {armed.text}
      </T>
      {/* there's room for every key beside the plan, so nothing needs folding away there. */}
      {sideBySide ? null : (
        <Button
          title=""
          label={folded ? 'Show all keys' : 'Hide keys to see the whole plan'}
          icon={folded ? 'up' : 'down'}
          iconSize={26}
          kind="utility"
          size="compact"
          onPress={toggleFold}
          style={styles.fold}
        />
      )}
    </View>
  );

  return (
    <ScreenIn>
      <View
        style={[
          styles.screen,
          sideBySide && styles.sideBySide,
          { backgroundColor: theme.background },
        ]}>
        {Platform.OS === 'web' ? null : <KeepAwake />}
        <StatusBar style="dark" />
        <Stack.Screen
          options={{
            title: layout.name,
            headerTitle: () => <PlanTitle name={layout.name} />,
            headerStyle: { backgroundColor: theme.background },
            headerTitleStyle: { color: theme.label },
            headerTintColor: theme.tint,
            ...headerKeys({
              right: (
                <View style={styles.headerRight}>
                  <SyncPill layoutId={layout.id} />
                  <MenuButton
                    label="More"
                    items={[
                      // android has no built-in text prompt, so renaming is ios and web only.
                      ...(Platform.OS === 'android'
                        ? []
                        : [{ title: 'Rename', icon: 'pencil' as const, onPress: renamePlan }]),
                      {
                        title: 'Delete plan',
                        icon: 'trash' as const,
                        destructive: true,
                        onPress: deletePlan,
                      },
                    ]}
                  />
                </View>
              ),
            }),
          }}
        />
        <View
          style={[styles.canvas, { borderColor: theme.border }]}
          ref={wheelRef}
          onLayout={onLayout}
          {...panHandlers}>
          <LayoutCanvas
            layout={layout}
            units={units}
            viewport={viewport}
            selectedId={selectedId ?? (mode === 'walls' ? undefined : wallInFocus?.id)}
            onSelect={(next) => {
              setSelectedId(next);
              setOffset(undefined);
              if (next) feedback.tap();
            }}
            ghostHeading={
              mode === 'walls' && armed.kind === 'wall' ? nextHeading(layout, turn) : undefined
            }
            animateId={layout.touchedId}
            // in add mode, mark the corner the distance is measured from.
            measureFromWallId={mode === 'features' ? wallInFocus?.id : undefined}
          />
          {/* zoom keys, since pinching doesn't work with a mouse or one gloved hand. */}
          <Pad style={styles.zoomPad}>
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
                  kind={icon === 'fit' && zoomed ? 'selected' : 'utility'}
                  onPress={run}
                />
              </PadRow>
            ))}
          </Pad>
          {sideBySide ? null : nextBar}
          <Toast id={result?.id ?? 0} text={result?.text} tone={result?.tone ?? 'green'} />
        </View>
        {sideBySide ? (
          // wide screens get one tall panel: next up on top, walls in the middle, keys below.
          <View style={[styles.sidePanel, { borderColor: theme.separator }]}>
            {nextBar}
            <WallList
              layout={layout}
              units={units}
              selectedWallId={selectedWall?.id ?? (mode === 'walls' ? undefined : wallInFocus?.id)}
              onSelect={(next) => {
                setSelectedId(next);
                setOffset(undefined);
              }}
              empty="Hook the tape on a corner. Measure the first wall."
            />
            {controls}
          </View>
        ) : (
          controls
        )}
        <Keypad
          visible={keypad}
          title={
            armed.kind === 'offset'
              ? `${FEATURE_LABELS[featureKind]}: distance from the corner`
              : armed.kind === 'width'
                ? `${FEATURE_LABELS[featureKind]}: width`
                : armed.text
          }
          picture={
            armed.kind === 'offset' ? 'from-corner' : armed.kind === 'width' ? 'width' : undefined
          }
          units={units}
          onCancel={() => setKeypad(false)}
          onDone={(mm) => {
            setKeypad(false);
            tape.typed(mm);
          }}
        />
      </View>
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  sideBySide: { flexDirection: 'row' },
  sidePanel: {
    width: 440,
    paddingTop: Space.l,
    paddingHorizontal: Space.s,
    gap: Space.s,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space.xl },
  canvas: { flex: 1, minHeight: 170, borderBottomWidth: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Space.s },
  controls: { paddingHorizontal: Space.s, paddingTop: Space.s, gap: Space.s },
  zoomPad: { position: 'absolute', top: Space.s, right: Space.s, width: 60 },
  controlsDocked: { paddingHorizontal: 0, paddingTop: 0 },
  next: {
    position: 'absolute',
    left: Space.s,
    right: Space.s,
    bottom: Space.s,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: 56,
    // the fold key sits the same distance from the top, bottom and right edges.
    paddingLeft: Space.m,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 2,
  },
  nextText: { flex: 1 },
  // docked in the side panel: an ordinary block, not floating over the plan.
  nextDocked: {
    position: 'relative',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 84,
    paddingVertical: Space.m,
  },
  fold: { width: 56 },
  modeRows: { gap: 3 },
  sticker: {
    position: 'absolute',
    top: -13,
    left: 14,
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    boxShadow: '0 2px 3px rgba(0, 0, 0, 0.25)',
  },
  stickerText: { fontWeight: '800', letterSpacing: 1.2 },
  caps: { fontWeight: '700', letterSpacing: 0.6 },
});
