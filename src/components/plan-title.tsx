import { StyleSheet, Text } from 'react-native';

import { Type, useTheme } from '@/lib/theme';

/**
 * a plan's name in the nav bar: "Room" in black, then the time it was started in amber, so
 * two plans of the same kind are easy to tell apart at a glance.
 */
export function PlanTitle({ name }: { name: string }) {
  const theme = useTheme();
  const [kind, time] = name.split(' · ');
  return (
    <Text
      accessibilityRole="header"
      numberOfLines={1}
      style={[Type.headline, styles.title, { color: theme.label }]}>
      {kind}
      {time ? <Text style={{ color: theme.accentText }}>{`  ${time}`}</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19 },
});
