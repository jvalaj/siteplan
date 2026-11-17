import { type ComponentRef, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import type { IconName } from '@/components/icon';
import { Button, Pad, PadRow } from '@/components/ui';
import { Space } from '@/lib/theme';

export type MenuItem = {
  title: string;
  icon: IconName;
  /** red marks, for the one that can't be undone. */
  destructive?: boolean;
  onPress: () => void;
};

const WIDTH = 240;

/**
 * a "…" key that drops a short menu of keys right under itself, like the pull-down menus in
 * apple's apps. tapping anywhere else closes it. it's the same keys as the rest of the app,
 * just stacked, so nothing new to learn.
 */
export function MenuButton({ label, items }: { label: string; items: MenuItem[] }) {
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const [at, setAt] = useState<{ top: number; right: number }>();
  const { width } = useWindowDimensions();

  function open() {
    // drop the menu from the key's bottom edge, lined up with its right edge.
    anchor.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
      setAt({ top: y + h + 6, right: Math.max(Space.s, width - (x + w)) });
    });
  }

  return (
    <>
      <View ref={anchor} collapsable={false}>
        <Button
          title=""
          label={label}
          kind={at ? 'selected' : 'utility'}
          icon="more"
          iconSize={28}
          onPress={open}
          style={styles.key}
        />
      </View>
      <Modal
        visible={!!at}
        transparent
        animationType="fade"
        onRequestClose={() => setAt(undefined)}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Close menu"
          onPress={() => setAt(undefined)}
        />
        {at ? (
          <Pad style={[styles.menu, { top: at.top, right: at.right }]}>
            {items.map((item) => (
              <PadRow key={item.title}>
                <Button
                  cell
                  title={item.title}
                  icon={item.icon}
                  iconSize={24}
                  kind={item.destructive ? 'destructive' : 'utility'}
                  size="field"
                  smallTitle
                  onPress={() => {
                    setAt(undefined);
                    item.onPress();
                  }}
                />
              </PadRow>
            ))}
          </Pad>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  key: { width: 56, height: 46 },
  menu: { position: 'absolute', width: WIDTH },
});
