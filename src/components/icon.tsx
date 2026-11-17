import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { type Theme, useTheme } from '@/lib/theme';

// small line drawings, all on the same 24-point grid with the same line weight, so they read
// as one family. a picture next to each word means nobody has to read to find a button.
const DRAWINGS = {
  // kinds of space
  room: (c: string) => (
    <>
      <Path d="M4 20V4h16v16h-6" />
      <Path d="M4 20h5" />
      <Path d="M9 20a5 5 0 0 1 5-5" strokeDasharray="2 2.5" />
    </>
  ),
  deck: () => (
    <>
      <Rect x={3} y={5} width={18} height={11} rx={1.5} />
      <Path d="M3 8.7h18M3 12.3h18" />
      <Path d="M6 16v4M18 16v4" />
    </>
  ),
  patio: () => (
    <>
      <Rect x={3.5} y={3.5} width={17} height={17} rx={1.5} />
      <Path d="M12 3.5v17M3.5 12h17" />
    </>
  ),
  // who you are
  field: () => (
    <>
      <Rect x={2.5} y={6} width={12} height={12} rx={3} />
      <Circle cx={8.5} cy={12} r={2.6} />
      <Path d="M14.5 15.5h7v-2.5" />
      <Path d="M17 15.5v-1.5M19.5 15.5v-1.5" strokeWidth={1.5} />
    </>
  ),
  office: () => (
    <>
      <Rect x={3} y={3.5} width={18} height={17} rx={2.5} />
      <Path d="M7 8h10v8h-4.5v-3.5H7z" />
      <Path d="M11 19h2" />
    </>
  ),
  // editor modes
  walls: () => <Path d="M4.5 4.5h15v15h-15z" />,
  features: () => (
    <>
      <Path d="M6.5 20.5V4.5h11v16" />
      <Path d="M3.5 20.5h17" />
      <Path d="M14 12.5v.5" strokeWidth={3} />
    </>
  ),
  measure: () => (
    <>
      <Path d="M3.5 15.5l12-12 5 5-12 12z" />
      <Path d="M8 11l2 2M11 8l2 2M14 5l2 2" />
    </>
  ),
  // features on a wall
  door: () => (
    <>
      <Path d="M6.5 20.5V4.5h11v16" />
      <Path d="M3.5 20.5h17" />
      <Path d="M14 12.5v.5" strokeWidth={3} />
    </>
  ),
  window: () => (
    <>
      <Rect x={4.5} y={4.5} width={15} height={15} rx={1.5} />
      <Path d="M12 4.5v15M4.5 12h15" />
    </>
  ),
  post: (c: string) => (
    <>
      <Rect x={9} y={3.5} width={6} height={14} rx={1} fill={c} />
      <Path d="M5 20.5h14" />
    </>
  ),
  step: () => <Path d="M3.5 19.5h5.5v-5h5.5v-5H20" />,
  // actions
  tape: () => (
    <>
      <Rect x={2.5} y={6} width={12} height={12} rx={3} />
      <Circle cx={8.5} cy={12} r={2.6} />
      <Path d="M14.5 15.5h7v-2.5" />
      <Path d="M17 15.5v-1.5M19.5 15.5v-1.5" strokeWidth={1.5} />
    </>
  ),
  caliper: () => (
    <>
      <Path d="M5 4v16M5 6h14M11 6v8M17 6v5" />
    </>
  ),
  undo: () => (
    <>
      <Path d="M8.5 5.5L4 10l4.5 4.5" />
      <Path d="M4 10h10.5a5 5 0 0 1 0 10H11" />
    </>
  ),
  keypad: (c: string) => (
    <>
      {[6, 12, 18].flatMap((x) =>
        [6, 12, 18].map((y) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} fill={c} />),
      )}
    </>
  ),
  left: () => (
    <>
      <Path d="M19 19.5V11a3 3 0 0 0-3-3H5.5" />
      <Path d="M9.5 4L5.5 8l4 4" />
    </>
  ),
  right: () => (
    <>
      <Path d="M5 19.5V11a3 3 0 0 1 3-3h10.5" />
      <Path d="M14.5 4l4 4-4 4" />
    </>
  ),
  close: () => (
    <>
      <Path d="M4.5 4.5h15v15h-15z" />
      <Path d="M8.5 12l2.5 2.5 4.5-5" />
    </>
  ),
  check: () => (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M8 12.5l2.8 2.8L16.2 9.5" />
    </>
  ),
  alert: () => (
    <>
      <Path d="M12 3.5l9.5 16.5h-19z" />
      <Path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
  more: (c: string) => (
    <>
      <Circle cx={12} cy={12} r={10} />
      {[7.5, 12, 16.5].map((x) => (
        <Circle key={x} cx={x} cy={12} r={1.4} fill={c} stroke="none" />
      ))}
    </>
  ),
  backspace: () => (
    <>
      <Path d="M9 5.5h11.5v13H9L3.5 12z" />
      <Path d="M12 9.5l5 5M17 9.5l-5 5" />
    </>
  ),
  sound: () => (
    <>
      <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <Path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  vibrate: () => (
    <>
      <Rect x={8} y={3.5} width={8} height={17} rx={2} />
      <Path d="M4.5 8v8M2 10v4M19.5 8v8M22 10v4" />
    </>
  ),
  up: () => <Path d="M5.5 15L12 8.5l6.5 6.5" />,
  down: () => <Path d="M5.5 9L12 15.5 18.5 9" />,
  back: () => <Path d="M14.5 5.5L8 12l6.5 6.5" />,
  forward: () => <Path d="M9.5 5.5L16 12l-6.5 6.5" />,
  pencil: () => <Path d="M15 5l4 4L8.5 19.5H4.5v-4zM13 7l4 4" />,
  plus: () => <Path d="M12 5v14M5 12h14" />,
  minus: () => <Path d="M5 12h14" />,
  fit: () => <Path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  trash: () => (
    <>
      <Path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
    </>
  ),
};

export type IconName = keyof typeof DRAWINGS;

export function Icon({
  name,
  size = 28,
  color = 'label',
}: {
  name: IconName;
  size?: number;
  color?: keyof Theme;
}) {
  const theme = useTheme();
  const stroke = theme[color];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round">
      {DRAWINGS[name](stroke)}
    </Svg>
  );
}
