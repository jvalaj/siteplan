import { type ReactNode, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { feedback } from '@/lib/feedback';
import { ease, useReduceMotion } from '@/lib/motion';
import { Control, Radius, Space, type Theme, Type, useTheme } from '@/lib/theme';

// animations run on the phone's own animation thread where that exists. browsers have none.
const NATIVE = Platform.OS !== 'web';

type Variant = keyof typeof Type;

/** text in one of apple's named styles. it follows the system text size setting. */
export function T({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: keyof Theme }) {
  const theme = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[Type[variant] as TextStyle, { color: theme[color ?? 'label'] }, style]}
    />
  );
}

/**
 * fades its contents in and slides them a short way into place when it appears. give it a new
 * `key` to play it again, for example when the screen switches to another mode. the motion is
 * short and small: it shows what changed and where it came from, then gets out of the way.
 */
export function Appear({
  children,
  style,
  from = 'below',
  duration = 260,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** `below` lifts up into place; `right` slides in from the side, like a new page. */
  from?: 'below' | 'right';
  duration?: number;
}) {
  const reduce = useReduceMotion();
  const [shown] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(shown, {
      toValue: 1,
      duration: reduce ? 0 : duration,
      easing: ease,
      useNativeDriver: NATIVE,
    }).start();
  }, [shown, reduce, duration]);
  const travel = shown.interpolate({
    inputRange: [0, 1],
    outputRange: [from === 'right' ? 28 : 10, 0],
  });
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: shown,
          transform: [from === 'right' ? { translateX: travel } : { translateY: travel }],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

/**
 * wraps a whole screen so it slides in when it opens. on a phone the navigation already slides
 * each screen in, so this only adds the motion in a browser, where pages would otherwise snap.
 */
export function ScreenIn({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <View style={styles.screenIn}>{children}</View>;
  return (
    <Appear from="right" duration={320} style={styles.screenIn}>
      {children}
    </Appear>
  );
}

/**
 * a message that drops in from the top, stays a moment, and leaves by itself, like a phone
 * notification. it reports what just happened without taking any room on the screen.
 * give it a new `id` each time there is something new to say.
 */
export function Toast({ id, text, tone }: { id: number; text?: string; tone: 'green' | 'orange' }) {
  const theme = useTheme();
  const reduce = useReduceMotion();
  const [slide] = useState(() => new Animated.Value(0));
  // what is on screen. it is kept while the message slides away, after `text` has moved on.
  const [showing, setShowing] = useState<{ text: string; tone: 'green' | 'orange' }>();

  useEffect(() => {
    if (!text) return;
    const arrive = requestAnimationFrame(() => setShowing({ text, tone }));
    // voiceover on ios ignores live regions, so read the message out directly.
    AccessibilityInfo.announceForAccessibility(text);
    Animated.spring(slide, {
      toValue: 1,
      speed: reduce ? 1000 : 18,
      bounciness: reduce ? 0 : 7,
      useNativeDriver: NATIVE,
    }).start();
    const leave = setTimeout(() => {
      Animated.timing(slide, {
        toValue: 0,
        duration: reduce ? 0 : 220,
        useNativeDriver: NATIVE,
      }).start(() => setShowing(undefined));
    }, 2200);
    return () => {
      cancelAnimationFrame(arrive);
      clearTimeout(leave);
    };
    // a new id means a new message, even when the words are the same as last time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!showing) return null;
  // solid green when it worked, solid red when something needs a look: the color alone says
  // which, from across the room. on a wide screen it stays a short pill in the middle instead
  // of a bar across the whole plan.
  const fill = showing.tone === 'green' ? theme.green : theme.red;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.toastSlot,
        {
          opacity: slide,
          transform: [
            { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-70, 0] }) },
          ],
        },
      ]}>
      <View style={[styles.toast, { backgroundColor: fill, borderColor: theme.seam }]}>
        <Icon name={showing.tone === 'green' ? 'check' : 'alert'} color="onRed" size={26} />
        <T variant="headline" color="onRed" numberOfLines={2} style={styles.toastText}>
          {showing.text}
        </T>
      </View>
    </Animated.View>
  );
}

/** the soft colors used to tell sections apart, with the strong color that goes on top. */
export type Tone = 'tint' | 'green' | 'orange' | 'purple' | 'teal';
const SOFT: Record<Tone, keyof Theme> = {
  tint: 'tintSoft',
  green: 'greenSoft',
  orange: 'orangeSoft',
  purple: 'purpleSoft',
  teal: 'tealSoft',
};

/** an icon on a soft colored square. the color says which section you are in. */
export function IconTile({ name, tone, size = 48 }: { name: IconName; tone: Tone; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: size * 0.28,
          backgroundColor: theme[SOFT[tone]],
        },
      ]}>
      <Icon name={name} size={size * 0.58} color={tone} />
    </View>
  );
}

type ButtonProps = {
  /** leave empty for a button that is only an icon, and give it a `label` instead. */
  title: string;
  /** what a screen reader says, when there is no title to read. */
  label?: string;
  /** a second, smaller line under the title. */
  detail?: string;
  icon?: IconName;
  /** overrides the icon's usual size. */
  iconSize?: number;
  /** put the icon above the title instead of beside it. */
  stacked?: boolean;
  /** a tall button with a large picture, for the main choices on a screen. */
  big?: boolean;
  /** one key of a `Pad`: flat, square-cornered, and touching its neighbours. */
  cell?: boolean;
  /**
   * keys come in a few colors, like a piece of hardware, and the color says what kind of key
   * it is:
   * `primary` is the dark key, and there is only one per screen: the main thing to do.
   * `selected` is solid orange and latched down: the choice that is on right now.
   * `go` is solid orange but not latched: confirm, like "use it".
   * `dark` is the dark key for a way out, like "cancel".
   * `secondary` is aluminium grey: a choice you can make.
   * `utility` is the light key: tools like undo, type, back and zoom.
   * `destructive` and `danger` are grey with a red mark.
   * `plain` has no key at all, just the mark.
   */
  kind?:
    | 'primary'
    | 'secondary'
    | 'utility'
    | 'go'
    | 'dark'
    | 'destructive'
    | 'danger'
    | 'selected'
    | 'plain';
  /** `field` and `primary` are sized for gloves. `regular` is for the office. */
  size?: 'compact' | 'regular' | 'field' | 'primary';
  /** use a smaller title in a tall button, when the row is tight. */
  smallTitle?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  label,
  detail,
  icon,
  iconSize,
  stacked,
  big,
  cell,
  kind = 'secondary',
  size = 'regular',
  smallTitle,
  disabled,
  onPress,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const [down, setDown] = useState(false);
  const [hover, setHover] = useState(false);

  // pressing pushes the key into the panel: it darkens and the shading flips, as if lit
  // from above. nothing moves sideways or grows, because a real key doesn't.
  const latched = kind === 'selected';
  const pushed = down || latched;
  // the face, and the color of the icon and words on it. black on orange and white on the
  // dark key are the pairs with the strongest contrast.
  const keys = {
    primary: [theme.keyDark, theme.keyDarkDown, 'onDark', 'onDark'],
    selected: [theme.accent, theme.accentDown, 'keyInk', 'keyInk'],
    go: [theme.accent, theme.accentDown, 'keyInk', 'keyInk'],
    dark: [theme.keyDark, theme.keyDarkDown, 'onDark', 'onDark'],
    secondary: [theme.keyFace, theme.keyDown, 'keyInk', 'keyInk'],
    utility: [theme.keyLight, theme.keyLightDown, 'keyInk', 'keyInk'],
    destructive: [theme.keyFace, theme.keyDown, 'red', 'red'],
    danger: [theme.keyFace, theme.keyDown, 'red', 'red'],
    plain: ['transparent', 'transparent', 'tint', 'tint'],
  } as const;
  const [rest, sunk, markColor, wordColor] =
    disabled && kind !== 'plain' ? keys.secondary : keys[kind];
  const mark: keyof Theme = markColor;
  const words: keyof Theme = wordColor;
  const face = down ? sunk : rest;
  const dark = kind === 'primary' || kind === 'dark';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? (detail ? `${title}, ${detail}` : title)}
      accessibilityState={{ disabled: !!disabled, selected: latched }}
      disabled={disabled}
      onPressIn={() => setDown(true)}
      onPressOut={() => setDown(false)}
      // with a mouse or trackpad (a mac, an ipad with a trackpad) the key under the pointer
      // dims a touch, so you can tell what a click will hit.
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onPress={() => {
        feedback.tap();
        onPress?.();
      }}
      style={[cell && styles.cellSlot, style]}>
      <View
        style={[
          styles.button,
          stacked && styles.stacked,
          big && styles.big,
          { minHeight: Control[size], backgroundColor: face },
          kind !== 'plain' && (cell ? styles.cell : [styles.single, { borderColor: theme.seam }]),
          kind !== 'plain' && (pushed ? styles.pushed : dark ? styles.restingDark : styles.resting),
          smallTitle && styles.tight,
          hover && !down && !disabled && kind !== 'plain' && styles.hover,
        ]}>
        <View
          style={[
            styles.contents,
            stacked && styles.contentsStacked,
            big && styles.contentsBig,
            disabled && styles.disabled,
          ]}>
          {icon ? (
            <Icon
              name={icon}
              size={iconSize ?? (big ? 44 : size === 'regular' ? 22 : 28)}
              color={mark}
            />
          ) : null}
          {title ? (
            <View style={styles.buttonText}>
              <T
                variant={
                  big
                    ? 'title1'
                    : smallTitle || stacked
                      ? 'headline'
                      : size === 'primary'
                        ? 'title2'
                        : size === 'field'
                          ? 'title3'
                          : 'headline'
                }
                color={words}
                numberOfLines={1}
                adjustsFontSizeToFit>
                {title}
              </T>
              {detail ? (
                <T
                  variant={big ? 'callout' : 'footnote'}
                  color={words}
                  numberOfLines={1}
                  style={styles.detail}>
                  {detail}
                </T>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * a key with anything on it, for rows that need more than an icon and a word (a plan in a
 * list, say). it looks and presses exactly like the other keys.
 */
export function KeyRow({
  children,
  label,
  selected,
  flat,
  style,
  onPress,
}: {
  children: ReactNode;
  label: string;
  /** latched down in yellow, like a selected key. */
  selected?: boolean;
  /** a calm card instead of a raised key: no bevel, one thin edge. for long grids of them on
   * a big screen, where rows of bevels and dark seams turn into stripes. */
  flat?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
}) {
  const theme = useTheme();
  const [down, setDown] = useState(false);
  const [hover, setHover] = useState(false);
  const face = selected
    ? down
      ? theme.accentDown
      : theme.accent
    : down
      ? theme.keyLightDown
      : theme.keyLight;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      onPressIn={() => setDown(true)}
      onPressOut={() => setDown(false)}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onPress={() => {
        feedback.tap();
        onPress();
      }}
      style={style}>
      <View
        style={[
          styles.keyRow,
          { backgroundColor: face },
          flat
            ? [styles.flat, { borderColor: theme.separator }, down && styles.flatDown]
            : down || selected
              ? styles.pushed
              : styles.resting,
          hover && !down && styles.hover,
        ]}>
        {children}
      </View>
    </Pressable>
  );
}

/** a row of choices where exactly one is on: keys in a frame, the chosen one latched down. */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
  size = 'field',
}: {
  options: { value: V; label: string; icon?: IconName }[];
  value: V;
  onChange: (value: V) => void;
  size?: 'regular' | 'field';
}) {
  return (
    <Pad>
      <PadRow>
        {options.map((option) => (
          <Button
            key={option.value}
            cell
            title={option.label}
            icon={option.icon}
            size={size === 'field' ? 'field' : 'regular'}
            smallTitle
            kind={option.value === value ? 'selected' : 'secondary'}
            onPress={() => onChange(option.value)}
          />
        ))}
      </PadRow>
    </Pad>
  );
}

/** a small status label: a dot plus words, so it never relies on color alone. */
export function Pill({ label, tone }: { label: string; tone: 'green' | 'orange' | 'secondary' }) {
  const theme = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: theme.card, borderColor: theme.seam }]}>
      <View style={[styles.dot, { backgroundColor: theme[tone] }]} />
      <T variant="subhead" style={styles.pillText}>
        {label}
      </T>
    </View>
  );
}

/**
 * a block of keys set into a dark frame, like a piece of hardware: one rounded panel cut into
 * pieces. the thin dark seams make each key its own target, so a gloved finger lands on one.
 * put `PadRow`s inside, and `Button cell`s inside those.
 */
export function Pad({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.pad, { backgroundColor: theme.seam, borderColor: theme.seam }, style]}>
      {children}
    </View>
  );
}

export function PadRow({ children }: { children: ReactNode }) {
  return <View style={styles.padRow}>{children}</View>;
}

/** a key-sized space in a pad that shows words instead of doing something. */
export function PadLabel({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.padLabel, wide && styles.padWide, { backgroundColor: theme.keyLight }]}>
      {children}
    </View>
  );
}

/** a section of the screen: a white box with an even edge. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}>
      {children}
    </View>
  );
}

const KEY_RADIUS = 10;
const FRAME_EDGE = 2;
const FRAME_PADDING = 2;

const styles = StyleSheet.create({
  screenIn: { flex: 1 },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    padding: Space.s,
    paddingRight: Space.m,
    borderRadius: KEY_RADIUS,
    borderCurve: 'continuous',
    // fills its slot, so two plans side by side are the same height.
    flexGrow: 1,
  },
  tile: { alignItems: 'center', justifyContent: 'center' },
  toastSlot: {
    position: 'absolute',
    top: Space.s,
    left: Space.s,
    right: Space.s,
    zIndex: 10,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: 60,
    paddingHorizontal: Space.l,
    paddingVertical: Space.m,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    borderWidth: 2,
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.22)',
  },
  toastText: { flex: 1 },
  button: {
    // fill the space the row gives, so buttons side by side are always the same height.
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    paddingHorizontal: Space.l,
    paddingVertical: Space.s,
  },
  stacked: { flexDirection: 'column', gap: Space.xs, paddingVertical: Space.m },
  big: { minHeight: 124, gap: Space.s },
  // a key on its own sits in its own thin dark frame.
  single: { borderWidth: FRAME_EDGE, borderRadius: KEY_RADIUS + FRAME_EDGE },
  // light catches the top edge and the bottom edge is in shade: the key stands proud of the panel.
  // the thick shaded lip along the bottom is the key's depth: it reads as a block you push.
  resting: {
    boxShadow:
      'inset 0 2px 0 rgba(255, 255, 255, 0.9), inset 0 -5px 0 rgba(0, 0, 0, 0.16), inset 0 -6px 1px rgba(0, 0, 0, 0.06)',
  },
  // a dark key catches less light on its top edge.
  restingDark: {
    boxShadow: 'inset 0 1.5px 0 rgba(255, 255, 255, 0.22), inset 0 -5px 0 rgba(0, 0, 0, 0.4)',
  },
  // pushed in: the lip disappears, the top edge falls into shadow, and the key sits a little
  // lower, the way a real key travels.
  pushed: {
    boxShadow: 'inset 0 4px 6px rgba(0, 0, 0, 0.32), inset 0 -1px 0 rgba(255, 255, 255, 0.25)',
    transform: [{ translateY: 1.5 }],
  },
  tight: { paddingHorizontal: Space.xs },
  hover: { filter: 'brightness(0.95)' },
  flat: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: 16 },
  flatDown: { transform: [{ scale: 0.99 }] },
  cellSlot: { flex: 1 },
  // corners are concentric, the way apple draws nested shapes: a key's corner is the frame's
  // corner minus the frame's edge and padding (14 - 2 - 2 = 10), so the curves run parallel.
  cell: { borderRadius: KEY_RADIUS, paddingHorizontal: Space.xs },
  pad: {
    borderRadius: KEY_RADIUS + FRAME_EDGE + FRAME_PADDING,
    borderCurve: 'continuous',
    borderWidth: FRAME_EDGE,
    overflow: 'hidden',
    padding: FRAME_PADDING,
    gap: 3,
  },
  padRow: { flexDirection: 'row', alignItems: 'stretch', gap: 3 },
  padLabel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.s,
    paddingVertical: Space.s,
    borderRadius: KEY_RADIUS,
  },
  padWide: { flex: 2 },
  buttonText: { alignItems: 'center', flexShrink: 1 },
  detail: { opacity: 0.75, fontWeight: '600' },
  disabled: { opacity: 0.3 },
  contents: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Space.s },
  contentsStacked: { flexDirection: 'column', gap: Space.xs },
  contentsBig: { gap: Space.s },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillText: { fontWeight: '700' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  card: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: Space.l,
    gap: Space.m,
  },
});
