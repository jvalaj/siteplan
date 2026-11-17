import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { Units } from '@/shared/format';

export interface Settings {
  units: Units;
  /** apple's guidance is that haptics are always optional. */
  haptics: boolean;
  sounds: boolean;
}

const KEY = 'siteplan.settings';
const DEFAULTS: Settings = { units: 'imperial', haptics: true, sounds: true };

let settings = DEFAULTS;
const listeners = new Set<() => void>();

AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (!raw) return;
    settings = { ...settings, ...JSON.parse(raw) };
    listeners.forEach((l) => l());
  })
  .catch(() => {});

export function getSettings() {
  return settings;
}

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, JSON.stringify(settings)).catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSettings() {
  return useSyncExternalStore(subscribe, getSettings, () => DEFAULTS);
}
