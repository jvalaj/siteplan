import { ScrollView, StyleSheet } from 'react-native';

import { PlanGrid } from '@/components/layout-list';
import { T, ScreenIn } from '@/components/ui';
import { sortedLayouts, useSync } from '@/lib/sync';
import { Space } from '@/lib/theme';

export default function OfficeHome() {
  const { layouts } = useSync();
  const list = sortedLayouts(layouts);
  return (
    <ScreenIn>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <T variant="title2">Plans</T>
        {list.length === 0 ? (
          <T color="secondary">None yet. They show up here when the crew starts one.</T>
        ) : (
          // newest change first, so the plan being worked on right now is always at the top.
          <PlanGrid layouts={list} to="office" />
        )}
      </ScrollView>
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.m, gap: Space.s, width: '100%', maxWidth: 1200, alignSelf: 'center' },
});
