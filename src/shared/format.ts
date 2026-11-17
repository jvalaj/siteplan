import type { Source } from './layout';

export type Units = 'imperial' | 'metric';

const MM_PER_INCH = 25.4;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** feet, inches and sixteenths, the way a tape reads: 3048 mm is 10' 0". */
export function formatFeetInches(mm: number): string {
  const totalSixteenths = Math.round((mm / MM_PER_INCH) * 16);
  const feet = Math.floor(totalSixteenths / (16 * 12));
  const rest = totalSixteenths - feet * 16 * 12;
  const inches = Math.floor(rest / 16);
  const sixteenths = rest % 16;
  let fraction = '';
  if (sixteenths > 0) {
    const divisor = gcd(sixteenths, 16);
    fraction = ` ${sixteenths / divisor}/${16 / divisor}`;
  }
  // under an inch, show just the fraction: 1/2" rather than 0 1/2".
  const inchPart =
    feet === 0 && inches === 0 && fraction ? `${fraction.trim()}"` : `${inches}${fraction}"`;
  return feet > 0 ? `${feet}' ${inchPart}` : inchPart;
}

/** a length for display; caliper readings keep fine detail, since that's why calipers exist. */
export function formatLength(mm: number, units: Units, source?: Source): string {
  if (source === 'caliper') {
    return units === 'imperial' ? `${(mm / MM_PER_INCH).toFixed(3)}"` : `${mm.toFixed(2)} mm`;
  }
  if (units === 'imperial') return formatFeetInches(mm);
  return `${Math.round(mm).toLocaleString('en-US')} mm`;
}

/** the same length in the other unit, for the small secondary line. */
export function formatOtherUnit(mm: number, units: Units, source?: Source): string {
  return formatLength(mm, units === 'imperial' ? 'metric' : 'imperial', source);
}

export function formatArea(mm2: number, units: Units): string {
  if (units === 'imperial') {
    const sqft = mm2 / (MM_PER_INCH * 12) ** 2;
    return `${sqft.toFixed(1)} sq ft`;
  }
  return `${(mm2 / 1e6).toFixed(2)} m²`;
}

export function feetInchesToMm(feet: number, inches: number, sixteenths: number): number {
  return (feet * 12 + inches + sixteenths / 16) * MM_PER_INCH;
}

/** "just now", "12 s ago", "4 min ago". */
export function formatAgo(ms: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(ms).toLocaleDateString();
}
