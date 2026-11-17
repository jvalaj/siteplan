// the app's animations. each one has a job:
//
//   - a new wall draws itself from its corner, so you see which way it went and that the
//     reading landed.
//   - the plan glides when it has to re-fit, so you never lose your place.
//   - buttons give a little under the finger, so a press feels like a press through gloves.
//
// all of them switch off when the phone's "Reduce Motion" setting is on.

import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Easing } from 'react-native';

/** apple-style ease: quick to start, gentle to settle. */
export const ease = Easing.bezier(0.2, 0.8, 0.2, 1);

export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduce)
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => subscription.remove();
  }, []);
  return reduce;
}

type Numbers = Record<string, number>;

/**
 * follows a set of numbers smoothly: when the target changes, the returned values glide to it
 * instead of jumping. used for the plan's zoom and position.
 */
export function useEased<T extends Numbers>(target: T, enabled: boolean, ms = 380): T {
  const [shown, setShown] = useState(target);
  // whether there is a sensible starting point to glide from. the very first target (before
  // the view has been measured) is not one, so that one is shown at once.
  const primed = useRef(false);
  const key = Object.values(target).join(',');

  useEffect(() => {
    if (!enabled) {
      primed.current = false;
      return;
    }
    const duration = primed.current ? ms : 0;
    primed.current = true;
    let frame = 0;
    let from: T | undefined;
    const started = Date.now();
    const tick = () => {
      const t = duration === 0 ? 1 : Math.min(1, (Date.now() - started) / duration);
      setShown((current) => {
        from ??= current;
        const next = {} as Numbers;
        for (const name of Object.keys(target)) {
          next[name] = from[name] + (target[name] - from[name]) * ease(t);
        }
        return next as T;
      });
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // `key` stands for every number in `target`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, ms]);

  return enabled ? shown : target;
}

/**
 * counts from 0 to 1 each time `id` changes to something new. the plan uses it to draw the
 * newest wall in. it does not run for whatever was already there when the screen opened.
 */
export function useDrawIn(id: string | undefined, enabled: boolean, ms = 420) {
  const [state, setState] = useState({ id, progress: 1 });

  useEffect(() => {
    if (!enabled || !id) return;
    let frame = 0;
    let first = true;
    const started = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - started) / ms);
      let skip = false;
      setState((current) => {
        // the id was already showing when this started: nothing new to draw.
        if (first && current.id === id) skip = true;
        first = false;
        return skip ? current : { id, progress: ease(t) };
      });
      if (t < 1 && !skip) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [id, enabled, ms]);

  return state.id === id ? state.progress : 1;
}
