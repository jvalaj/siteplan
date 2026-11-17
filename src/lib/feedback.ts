// what the app does, besides changing the screen, when something happens: a vibration and a
// short sound. dana often can't look at the phone, and on a loud site she may not hear it, so
// every event uses both.
//
// each event always feels and sounds the same:
//   tap  - any button. a light tap and a soft tick. it is kept light on purpose: if every
//          key buzzed hard, dana would learn to ignore the buzz that matters.
//   done - a reading landed. the strong "success" buzz and two rising notes.
//   oops - something needs checking. the "warning" buzz and two falling notes.
//
// both can be turned off on the home screen. sounds also follow the phone's silent switch,
// like every apple app: if the ringer is off, only the buzz plays.

import { createAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { getSettings } from '@/lib/settings';

type Sound = 'tap' | 'done' | 'oops';

const files = {
  tap: require('../../assets/sounds/tap.wav'),
  done: require('../../assets/sounds/done.wav'),
  oops: require('../../assets/sounds/oops.wav'),
};

// players are made the first time a sound is needed, then kept and replayed.
const players: Partial<Record<Sound, ReturnType<typeof createAudioPlayer>>> = {};

function sound(name: Sound) {
  if (!getSettings().sounds) return;
  try {
    const player = (players[name] ??= createAudioPlayer(files[name]));
    // the key tick is quieter than the two event sounds.
    player.volume = name === 'tap' ? 0.35 : 1;
    player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // no sound is never worth breaking a measurement for.
  }
}

function buzz(run: () => Promise<void>) {
  if (Platform.OS === 'web' || !getSettings().haptics) return;
  run().catch(() => {});
}

export const feedback = {
  tap() {
    buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    sound('tap');
  },
  done() {
    buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    sound('done');
  },
  oops() {
    buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
    sound('oops');
  },
};
