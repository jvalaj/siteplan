import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { LogBox, Platform, useColorScheme } from 'react-native';

import { SyncPill } from '@/components/sync-pill';
import { Button } from '@/components/ui';
import { headerKeys } from '@/lib/header';
import { useTheme } from '@/lib/theme';

// react-native-svg spams a harmless "unknown event handler" warning in browsers, so hide it.
LogBox.ignoreLogs(['Unknown event handler property']);
if (Platform.OS === 'web' && __DEV__) {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Unknown event handler property')) return;
    original(...args);
  };
}

/** a big square back key that's easy to hit with a glove and matches the other keys. */
function BackButton() {
  const router = useRouter();
  return (
    <Button
      title=""
      label="Back"
      kind="utility"
      icon="back"
      iconSize={30}
      // with no screen behind (a link opened straight to a plan), go home instead.
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={{ width: 56, height: 46, marginRight: 10 }}
    />
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = useTheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerTintColor: theme.tint,
          headerTitleStyle: { color: theme.label },
          headerBackVisible: false,
          animation: 'slide_from_right',
          // ios 26 makes a colorless header glass; a solid colour keeps the plan below it.
          headerStyle: { backgroundColor: theme.background },
          headerShadowVisible: false,
          ...headerKeys({ left: <BackButton />, right: <SyncPill /> }),
          contentStyle: { backgroundColor: theme.grouped },
        }}>
        <Stack.Screen
          name="index"
          options={{
            title: 'Siteplan',
            ...headerKeys({ left: null }),
            headerTitle: () => (
              <Image
                source={require('../../assets/brand/reekon.png')}
                accessibilityLabel="Reekon"
                contentFit="contain"
                // no back key beside it in a browser, so it needs its own gap from the edge.
                style={{ width: 128, height: 38, marginLeft: Platform.OS === 'web' ? 16 : 0 }}
              />
            ),
          }}
        />
        <Stack.Screen name="field/index" options={{ title: 'Field' }} />
        <Stack.Screen name="field/[id]" options={{ title: 'Layout' }} />
        <Stack.Screen name="office/index" options={{ title: 'Office' }} />
        <Stack.Screen name="office/[id]" options={{ title: 'Layout' }} />
      </Stack>
    </ThemeProvider>
  );
}
