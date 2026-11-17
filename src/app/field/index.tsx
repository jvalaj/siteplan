import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import type { IconName } from '@/components/icon';
import { PlanGrid } from '@/components/layout-list';
import { Button, Pad, PadRow, T, ScreenIn } from '@/components/ui';
import { saveLayout, sortedLayouts, useSync } from '@/lib/sync';
import { Space } from '@/lib/theme';
import { newLayout, SPACE_LABELS, type SpaceKind } from '@/shared/layout';

const KINDS: { kind: SpaceKind; icon: IconName }[] = [
  { kind: 'room', icon: 'room' },
  { kind: 'deck', icon: 'deck' },
  { kind: 'patio', icon: 'patio' },
];

export default function FieldHome() {
  const router = useRouter();
  const { layouts } = useSync();
  const list = sortedLayouts(layouts);

  // one tap starts a plan; the name is auto-filled since typing with gloves is a pain.
  function start(kind: SpaceKind) {
    const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const layout = newLayout(kind, `${SPACE_LABELS[kind]} · ${time}`, 'Dana');
    saveLayout(layout);
    router.push({ pathname: '/field/[id]', params: { id: layout.id } });
  }

  return (
    <ScreenIn>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <T variant="title2">New</T>
        <Pad>
          <PadRow>
            {KINDS.map(({ kind, icon }) => (
              <Button
                key={kind}
                cell
                stacked
                big
                title={SPACE_LABELS[kind]}
                icon={icon}
                size="primary"
                onPress={() => start(kind)}
              />
            ))}
          </PadRow>
        </Pad>

        <T variant="title2" style={styles.section}>
          Your plans
        </T>
        {list.length === 0 ? (
          <T color="secondary">None yet. Tap one above.</T>
        ) : (
          <PlanGrid layouts={list} to="field" />
        )}
      </ScrollView>
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.m, gap: Space.s, width: '100%', maxWidth: 1200, alignSelf: 'center' },
  section: { marginTop: Space.l },
});
