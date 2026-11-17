import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * keyboard shortcuts for a mac (or anything running the web build). on a desk, reaching for the
 * trackpad for every reading is slow, so the main keys get a letter.
 *
 * keys are named like the browser names them: 'r', ' ', 'ArrowLeft', '+', 'Escape'. add 'mod+'
 * for command (or ctrl), e.g. 'mod+z'. typing in a text field never fires a shortcut.
 */
export function useShortcuts(map: Record<string, () => void>, enabled = true) {
  // always call the newest handlers without re-adding the listener each render.
  const latest = useRef(map);
  useEffect(() => {
    latest.current = map;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))
        return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const run = latest.current[mod ? `mod+${key}` : key];
      if (!run || event.altKey) return;
      event.preventDefault();
      run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
