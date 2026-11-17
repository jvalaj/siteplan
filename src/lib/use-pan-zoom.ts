import { useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  PanResponder,
  Platform,
} from 'react-native';

import { FIT, type Viewport } from '@/components/layout-canvas';
import { ease } from '@/lib/motion';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 12;
const clamp = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

function measure(e: GestureResponderEvent) {
  const touches = e.nativeEvent.touches;
  const [a, b] = touches;
  if (touches.length >= 2) {
    return {
      midX: (a.pageX + b.pageX) / 2,
      midY: (a.pageY + b.pageY) / 2,
      distance: Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY),
    };
  }
  const one = a ?? e.nativeEvent;
  return { midX: one.pageX, midY: one.pageY, distance: 0 };
}

/**
 * drag to move and pinch to zoom, plus the same moves as plain functions so buttons can do
 * everything the gestures do.
 *
 * it uses react native's built-in PanResponder. that works the same in expo go, on ios,
 * android and the web, with nothing extra to install.
 */
export function usePanZoom() {
  const [viewport, setViewport] = useState<Viewport>(FIT);

  // everything the gesture needs to remember between finger movements. it is created once
  // and changed in place, because it must not reset when the screen re-renders mid-gesture.
  const [handlers] = useState(() => {
    const g = {
      view: FIT,
      start: FIT,
      fingers: 0,
      distance: 0,
      midX: 0,
      midY: 0,
      originX: 0,
      originY: 0,
      width: 0,
      height: 0,
    };

    const show = (next: Viewport) => {
      g.view = next;
      setViewport(next);
    };

    const begin = (e: GestureResponderEvent) => {
      const one = e.nativeEvent.touches[0] ?? e.nativeEvent;
      Object.assign(g, measure(e), {
        start: g.view,
        fingers: e.nativeEvent.touches.length,
        // where the plan's top-left corner is on the page.
        originX: one.pageX - one.locationX,
        originY: one.pageY - one.locationY,
      });
    };

    const responder = PanResponder.create({
      // let taps through to the plan (to select a wall); only take over once fingers move.
      onStartShouldSetPanResponder: () => false,
      // "capture" so the plan wins over the tappable walls and badges under the fingers.
      // without it, a pinch that starts on a wall number stays with the wall and never zooms.
      onMoveShouldSetPanResponderCapture: (e, move) =>
        e.nativeEvent.touches.length >= 2 || Math.abs(move.dx) + Math.abs(move.dy) > 6,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        cancelAnimationFrame(frame);
        begin(e);
      },
      onPanResponderMove: (e) => {
        // a finger was added or lifted: start measuring again from here, so nothing jumps.
        if (e.nativeEvent.touches.length !== g.fingers) begin(e);
        const { midX, midY, distance } = measure(e);
        const zoom =
          g.fingers >= 2 && g.distance > 0
            ? clamp(g.start.zoom * (distance / g.distance))
            : g.start.zoom;
        const ratio = zoom / g.start.zoom;
        // keep the point under the fingers under the fingers while zooming.
        const fromCenterX = g.midX - g.originX - g.width / 2;
        const fromCenterY = g.midY - g.originY - g.height / 2;
        show({
          zoom,
          panX: fromCenterX - (fromCenterX - g.start.panX) * ratio + (midX - g.midX),
          panY: fromCenterY - (fromCenterY - g.start.panY) * ratio + (midY - g.midY),
        });
      },
    });

    // the zoom buttons glide to the new view, so it is clear what moved where. fingers on
    // the glass move the plan directly, with no glide, so it never lags behind them.
    let frame = 0;
    const glideTo = (target: Viewport) => {
      cancelAnimationFrame(frame);
      const from = g.view;
      const started = Date.now();
      const tick = () => {
        const t = ease(Math.min(1, (Date.now() - started) / 300));
        show({
          zoom: from.zoom + (target.zoom - from.zoom) * t,
          panX: from.panX + (target.panX - from.panX) * t,
          panY: from.panY + (target.panY - from.panY) * t,
        });
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    // on a mac, a trackpad pinch reaches the browser as a scroll with ctrl held down, and a
    // two-finger swipe as a plain scroll. turn those into zoom and pan, around the pointer.
    let node: HTMLElement | null = null;
    const onWheel = (e: WheelEvent) => {
      if (!node) return;
      e.preventDefault(); // otherwise the browser zooms or scrolls the whole page instead.
      cancelAnimationFrame(frame);
      const box = node.getBoundingClientRect();
      const v = g.view;
      if (e.ctrlKey || e.metaKey) {
        const zoom = clamp(v.zoom * Math.exp(-e.deltaY * 0.01));
        const ratio = zoom / v.zoom;
        const x = e.clientX - box.left - box.width / 2;
        const y = e.clientY - box.top - box.height / 2;
        show({ zoom, panX: x - (x - v.panX) * ratio, panY: y - (y - v.panY) * ratio });
      } else {
        show({ ...v, panX: v.panX - e.deltaX, panY: v.panY - e.deltaY });
      }
    };
    const wheelRef = (next: unknown) => {
      if (Platform.OS !== 'web') return;
      node?.removeEventListener('wheel', onWheel);
      node = (next as HTMLElement | null) ?? null;
      // "passive: false" is what lets preventDefault stop the page from zooming.
      node?.addEventListener('wheel', onWheel, { passive: false });
    };

    return {
      wheelRef,
      panHandlers: responder.panHandlers,
      onLayout: (e: LayoutChangeEvent) => {
        g.width = e.nativeEvent.layout.width;
        g.height = e.nativeEvent.layout.height;
      },
      zoomBy: (factor: number) => {
        const zoom = clamp(g.view.zoom * factor);
        const ratio = zoom / g.view.zoom;
        glideTo({ zoom, panX: g.view.panX * ratio, panY: g.view.panY * ratio });
      },
      fit: () => glideTo(FIT),
    };
  });

  return { viewport, ...handlers };
}
