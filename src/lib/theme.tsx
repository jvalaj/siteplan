import { createContext, type ReactNode, useContext } from 'react';
import { useColorScheme } from 'react-native';

// colors start from apple's system palette, then go darker where needed. the app is used in
// direct sun, so text and controls aim for 7:1 contrast rather than the usual 4.5:1.
const light = {
  background: '#FFFFFF',
  grouped: '#F2F2F7',
  card: '#FFFFFF',
  fill: '#E9E9EE',
  label: '#000000',
  secondary: '#4A4A4F',
  separator: '#C6C6C8',
  tint: '#0050C8',
  onTint: '#FFFFFF',
  green: '#1B6E30',
  orange: '#A84800',
  red: '#B8221A',
  redPressed: '#8E1811',
  onRed: '#FFFFFF',
  purple: '#6D34B0',
  teal: '#00656E',
  wall: '#000000',
  shapeFill: '#EAF1FD',
  // edges and shadows that make a button look like something you can press.
  border: '#B9B9C0',
  pressed: '#D6D6DD',
  tintPressed: '#003A94',
  // soft backgrounds, one per kind of thing, so sections can be told apart at a glance.
  tintSoft: '#E1ECFF',
  greenSoft: '#DDF2E2',
  orangeSoft: '#FBE9D9',
  purpleSoft: '#EEE4FB',
  tealSoft: '#D9F1F3',
  // the keys. aluminium grey keys in a dark frame, like a piece of hardware, in reekon's own
  // colours: its navy for the frame and the dark keys, its yellow for whatever is on.
  keyFace: '#D3D3D7',
  keyDown: '#B9B9BE',
  keyLatched: '#C3C3C8',
  keyInk: '#141416',
  seam: '#151B23',
  accent: '#FFA700',
  // yellow is too light to read as text on white, so words and thin lines use a deep amber.
  accentText: '#8F5F00',
  keyLight: '#F4F4F6',
  keyLightDown: '#DCDCE1',
  keyDark: '#1D2630',
  keyDarkDown: '#121821',
  onDark: '#FFFFFF',
  accentDown: '#E39200',
};

const dark: typeof light = {
  background: '#000000',
  grouped: '#000000',
  card: '#1C1C1E',
  fill: '#2C2C2E',
  label: '#FFFFFF',
  secondary: '#C7C7CC',
  separator: '#48484A',
  tint: '#5EB0FF',
  onTint: '#00152E',
  green: '#4CD964',
  orange: '#FFB340',
  red: '#FF6961',
  redPressed: '#D9483F',
  onRed: '#2B0000',
  purple: '#D4A5FF',
  teal: '#5DE6F0',
  wall: '#FFFFFF',
  shapeFill: '#0E2038',
  border: '#4A4A4E',
  pressed: '#3A3A3C',
  tintPressed: '#9CCBFF',
  tintSoft: '#0E2644',
  greenSoft: '#0F2E17',
  orangeSoft: '#3A2408',
  purpleSoft: '#2A1B40',
  tealSoft: '#0B2E32',
  // the keys. aluminium grey keys in a dark frame, like a piece of hardware, in reekon's own
  // colours: its navy for the frame and the dark keys, its yellow for whatever is on.
  keyFace: '#D3D3D7',
  keyDown: '#B9B9BE',
  keyLatched: '#C3C3C8',
  keyInk: '#141416',
  seam: '#151B23',
  accent: '#FFA700',
  // yellow is too light to read as text on white, so words and thin lines use a deep amber.
  accentText: '#8F5F00',
  keyLight: '#F4F4F6',
  keyLightDown: '#DCDCE1',
  keyDark: '#1D2630',
  keyDarkDown: '#121821',
  onDark: '#FFFFFF',
  accentDown: '#E39200',
};

export type Theme = typeof light;

const SchemeOverride = createContext<'light' | 'dark' | undefined>(undefined);

/** forces everything inside it into light or dark, whatever the phone is set to. */
export function ColorSchemeOverride({
  value,
  children,
}: {
  value: 'light' | 'dark';
  children: ReactNode;
}) {
  return <SchemeOverride.Provider value={value}>{children}</SchemeOverride.Provider>;
}

export function useTheme(): Theme {
  const forced = useContext(SchemeOverride);
  const system = useColorScheme();
  return (forced ?? system) === 'dark' ? dark : light;
}

/** apple's text styles, by name and size. */
export const Type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;

export const Space = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24 } as const;

/** apple's minimum control size is 44 pt. field controls are much larger, for gloves. */
export const Control = { compact: 44, minimum: 44, regular: 50, field: 68, primary: 84 } as const;

export const Radius = { control: 14, card: 20 } as const;
