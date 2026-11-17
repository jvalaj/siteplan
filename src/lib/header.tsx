import type { ReactElement } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Space } from '@/lib/theme';

/** on ios 26, skip the glass bubble behind header buttons since our keys already look like keys. */
export function headerKeys({ left, right }: { left?: ReactElement | null; right?: ReactElement }) {
  if (Platform.OS !== 'ios') {
    // on web, pad header buttons off the window edge like the phone header does.
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
