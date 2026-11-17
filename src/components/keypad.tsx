import { useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { Button, Pad, PadRow, T } from '@/components/ui';
import { useShortcuts } from '@/lib/shortcuts';
import { Radius, Space, useTheme } from '@/lib/theme';
import { feetInchesToMm, type Units } from '@/shared/format';

/**
 * a number pad for when the tape isn't connected or a reading needs correcting. the keys are
 * big enough for gloves. in feet and inches there is no decimal point to hit: you type the
 * feet, tap FT, type the inches, tap IN, and anything after that is sixteenths.
 */
/**
 * a little drawing of the measurement being asked for, because "from the corner" is easy to
 * misread when the plan is hidden behind the keypad. the arrow is the number to type.
 */
function Picture({ kind }: { kind: 'from-corner' | 'width' }) {
  const theme = useTheme();
  const ink = theme.keyInk;
  const yellow = theme.accent;
  const navy = theme.keyDark;
  return (
    // the drawing repeats the title, so screen readers skip it. (a View, because svg passes
    // the prop straight into the browser, which complains.)
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height={64} viewBox="0 0 300 64">
        {/* the wall, a corner at the left, and the door or window sitting in it */}
        <Line x1={20} y1={40} x2={290} y2={40} stroke={ink} strokeWidth={5} strokeLinecap="round" />
        <Rect
          x={170}
          y={34}
          width={70}
          height={12}
          fill={theme.background}
          stroke={ink}
          strokeWidth={2}
        />
        {kind === 'from-corner' ? (
          <>
            <Circle cx={20} cy={40} r={9} fill={yellow} stroke={navy} strokeWidth={2.5} />
            <Line
              x1={20}
              y1={18}
              x2={170}
              y2={18}
              stroke={navy}
              strokeWidth={4}
              strokeLinecap="round"
            />
            <Path
              d="M160 11 L170 18 L160 25"
              stroke={navy}
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <SvgText
              x={20}
              y={62}
              fontSize={12}
              fontWeight="700"
              // browsers draw svg text in a serif font unless told otherwise.
              fontFamily={
                Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : undefined
              }
              fill={navy}
              textAnchor="middle">
              tape here
            </SvgText>
          </>
        ) : (
          <>
            <Line
              x1={170}
              y1={18}
              x2={240}
              y2={18}
              stroke={navy}
              strokeWidth={4}
              strokeLinecap="round"
            />
            <Path
              d="M178 11 L170 18 L178 25 M232 11 L240 18 L232 25"
              stroke={navy}
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
      </Svg>
    </View>
  );
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function Keypad({
  visible,
  title,
  picture,
  units,
  onDone,
  onCancel,
}: {
  visible: boolean;
  title: string;
  /** a small drawing of what to measure, for the feature steps. */
  picture?: 'from-corner' | 'width';
  units: Units;
  onDone: (mm: number) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const [digits, setDigits] = useState('');
  const [feet, setFeet] = useState<number>();
  const [inches, setInches] = useState<number>();

  function clear() {
    setDigits('');
    setFeet(undefined);
    setInches(undefined);
  }

  const number = digits === '' ? 0 : Number(digits);
  let mm = number;
  let shown = `${digits || '0'} mm`;
  if (units === 'imperial') {
    if (feet === undefined) {
      // nothing marked yet: a bare number is inches.
      mm = feetInchesToMm(0, number, 0);
      shown = `${digits || '0'}"`;
    } else if (inches === undefined) {
      mm = feetInchesToMm(feet, number, 0);
      shown = `${feet}' ${digits || '0'}"`;
    } else {
      mm = feetInchesToMm(feet, inches, Math.min(number, 15));
      const sixteenths = Math.min(number, 15);
      const divisor = sixteenths ? gcd(sixteenths, 16) : 1;
      shown = sixteenths
        ? `${feet}' ${inches} ${sixteenths / divisor}/${16 / divisor}"`
        : `${feet}' ${inches}"`;
    }
  }

  function press(key: string) {
    if (key === 'FT') {
      if (feet === undefined) {
        setFeet(number);
        setDigits('');
      }
    } else if (key === 'IN') {
      if (inches === undefined) {
        if (feet === undefined) setFeet(0);
        setInches(Math.min(number, 11));
        setDigits('');
      }
    } else if (key === 'C') {
      clear();
    } else if (key === '⌫') {
      if (digits) setDigits(digits.slice(0, -1));
      else clear();
    } else if (digits.length < 6) {
      // no leading zeros: 0 then 8 is 8, not 08.
      setDigits(digits === '0' ? key : digits + key);
    }
  }

  // digits are grey keys. clear and delete are light tool keys, so they never look like a
  // number. in feet and inches there is an extra row for them, under FT 0 IN.
  const rows =
    units === 'imperial'
      ? [
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          ['FT', '0', 'IN'],
          ['C', '⌫'],
        ]
      : [
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          ['C', '0', '⌫'],
        ];
  const tools = ['C', '⌫', 'FT', 'IN'];

  function finish() {
    if (mm <= 0) return;
    clear();
    onDone(Math.round(mm * 100) / 100);
  }
  function cancel() {
    clear();
    onCancel();
  }

  // on a mac you can just type the number. ' marks feet and " marks inches, like on paper.
  useShortcuts(
    {
      ...Object.fromEntries('0123456789'.split('').map((d) => [d, () => press(d)])),
      Backspace: () => press('⌫'),
      c: () => press('C'),
      ...(units === 'imperial' && {
        "'": () => press('FT'),
        f: () => press('FT'),
        '"': () => press('IN'),
        i: () => press('IN'),
      }),
      Enter: finish,
      Escape: cancel,
    },
    visible,
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <T variant="headline" color="secondary">
            {title}
          </T>
          {picture ? <Picture kind={picture} /> : null}
          <View style={styles.readout}>
            <T variant="largeTitle" style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
              {shown}
            </T>
          </View>
          <Pad>
            {rows.map((row) => (
              <PadRow key={row.join()}>
                {row.map((key) => (
                  <Button
                    key={key}
                    cell
                    title={key === '⌫' ? '' : key === 'C' ? 'Clear' : key}
                    label={key === '⌫' ? 'Delete' : key === 'C' ? 'Clear' : key}
                    icon={key === '⌫' ? 'backspace' : undefined}
                    iconSize={30}
                    kind={tools.includes(key) ? 'utility' : 'secondary'}
                    size="field"
                    smallTitle={key.length > 1}
                    onPress={() => press(key)}
                  />
                ))}
              </PadRow>
            ))}
            <PadRow>
              <Button cell title="Cancel" kind="dark" size="field" smallTitle onPress={cancel} />
              <Button
                cell
                title="Use it"
                icon="check"
                kind="go"
                size="field"
                smallTitle
                disabled={mm <= 0}
                onPress={finish}
              />
            </PadRow>
          </Pad>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
    borderCurve: 'continuous',
    padding: Space.xl,
    paddingBottom: Space.xxl + Space.l,
    gap: Space.m,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  readout: { flexDirection: 'row', alignItems: 'center', gap: Space.l },
  value: { flex: 1, fontVariant: ['tabular-nums'] },
});
