import type { ReactElement } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Space } from '@/lib/theme';

/**
 * on ios 26 every header button sits on a grey glass bubble. our keys already look like keys,
 * so the bubble just doubles them up. on ios we hand the keys over as "custom items" with the
 * bubble turned off. everywhere else the normal headerLeft / headerRight still work.
 */
export function headerKeys({ left, right }: { left?: ReactElement | null; right?: ReactElement }) {
  if (Platform.OS !== 'ios') {
    // in a browser the header puts its buttons flush against the window edge. give them the
    // same breathing room the phone header has.
    const web = Platform.OS === 'web';
    return {
      ...(left !== undefined && {
        headerLeft: () => (web && left ? <View style={styles.left}>{left}</View> : left),
      }),
      ...(right && {
        headerRight: () => (web ? <View style={styles.right}>{right}</View> : right),
      }),
    };
  }
  const item = (element: ReactElement) => ({
    type: 'custom' as const,
    element,
    hidesSharedBackground: true,
  });
  return {
    ...(left !== undefined && { unstable_headerLeftItems: () => (left ? [item(left)] : []) }),
    ...(right && { unstable_headerRightItems: () => [item(right)] }),
  };
}

const styles = StyleSheet.create({
  left: { marginLeft: Space.m },
  right: { marginRight: Space.m },
});
