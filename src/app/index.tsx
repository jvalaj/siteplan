import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Appear, Button, Pad, PadLabel, PadRow, T, ScreenIn } from '@/components/ui';
import { updateSettings, useSettings } from '@/lib/settings';
import { Space } from '@/lib/theme';

/** a setting's name, on the same kind of plate the keys sit next to. */
function Name({ children }: { children: string }) {
  return (
    <PadLabel wide>
      <T variant="title2" style={styles.name}>
        {children}
      </T>
    </PadLabel>
  );
}

/**
 * the home screen is one piece of hardware: two big keys to pick who you are, and the
 * settings as rows of keys under them. the setting that is on stays pushed in, in orange.
 */
export default function HomeScreen() {
  const router = useRouter();
  const settings = useSettings();
  const [open, setOpen] = useState<'haptics' | 'sounds'>();
  const { width, height } = useWindowDimensions();
  // on an ipad or a mac the two big keys get bigger, and everything sits in the middle of the
  // screen instead of in a strip at the top.
  const big = width >= 760 && height >= 600;
  const onOff = (value: boolean, set: (next: boolean) => void) => (
    <>
      <Button
        cell
        title="Off"
        smallTitle
        kind={value ? 'secondary' : 'selected'}
        onPress={() => set(false)}
      />
      <Button
        cell
        title="On"
        smallTitle
        kind={value ? 'selected' : 'secondary'}
        onPress={() => set(true)}
      />
    </>
  );

  return (
    <ScreenIn>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.content, big && styles.contentBig]}>
        <Pad>
          <PadRow>
            <Button
              cell
              stacked
              big
              title="Field"
              detail="Measure a space"
              icon="field"
              iconSize={big ? 96 : 64}
              size="primary"
              kind="utility"
              style={[styles.role, big && styles.roleBig]}
              onPress={() => router.push('/field')}
            />
            <Button
              cell
              stacked
              big
              title="Office"
              detail="See the plans"
              icon="office"
              iconSize={big ? 96 : 64}
              size="primary"
              kind="utility"
              style={[styles.role, big && styles.roleBig]}
              onPress={() => router.push('/office')}
            />
          </PadRow>
        </Pad>

        <Pad>
          <PadRow>
            <Name>Units</Name>
            <Button
              cell
              title="ft"
              label="Feet and inches"
              size="field"
              kind={settings.units === 'imperial' ? 'selected' : 'secondary'}
              onPress={() => updateSettings({ units: 'imperial' })}
            />
            <Button
              cell
              title="mm"
              label="Millimeters"
              size="field"
              kind={settings.units === 'metric' ? 'selected' : 'secondary'}
              onPress={() => updateSettings({ units: 'metric' })}
            />
          </PadRow>
        </Pad>

        {/* the two settings you rarely touch fold away into square keys at the bottom. the icon
          shows whether it is on; tap to open its off/on keys. */}
        <View style={styles.tray}>
          <Pad style={styles.tiny}>
            <PadRow>
              {(['haptics', 'sounds'] as const).map((name) => (
                <Button
                  key={name}
                  cell
                  title=""
                  label={`${name === 'haptics' ? 'Vibrate' : 'Sound'}, ${settings[name] ? 'on' : 'off'}. Change`}
                  icon={name === 'haptics' ? 'vibrate' : 'sound'}
                  iconSize={30}
                  size="field"
                  kind={open === name ? 'selected' : 'utility'}
                  onPress={() => setOpen(open === name ? undefined : name)}
                />
              ))}
            </PadRow>
          </Pad>
        </View>
        {open ? (
          <Appear key={open}>
            <Pad>
              <PadRow>
                <Name>{open === 'haptics' ? 'Vibrate' : 'Sound'}</Name>
                {onOff(settings[open], (value) => updateSettings({ [open]: value }))}
              </PadRow>
            </Pad>
          </Appear>
        ) : null}
      </ScrollView>
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.m, gap: Space.m, width: '100%', maxWidth: 720, alignSelf: 'center' },
  contentBig: { flexGrow: 1, justifyContent: 'center', maxWidth: 860 },
  role: { minHeight: 220 },
  roleBig: { minHeight: 340 },
  name: { alignSelf: 'flex-start' },
  tray: { alignItems: 'flex-start' },
  tiny: { width: 168 },
});
