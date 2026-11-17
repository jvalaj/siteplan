// local-first copy of every layout: edits save on the device now and sync to the server later.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { type ClientMessage, isNewer, type Layout, type ServerMessage } from '@/shared/layout';

const KEY = 'siteplan.layouts';
const PORT = 4100;
const PING_MS = 15_000;

export type Status = 'connecting' | 'live' | 'offline';

export interface SyncState {
  layouts: Record<string, Layout>;
  /** ids of layouts with edits the server has not confirmed yet. */
  unsent: string[];
  status: Status;
  /** false until the copy saved on this device has been read. */
  ready: boolean;
}

let state: SyncState = { layouts: {}, unsent: [], status: 'connecting', ready: false };
let deleted: string[] = [];
const listeners = new Set<() => void>();

function set(patch: Partial<SyncState>, persist = true) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  if (persist && state.ready) {
    const saved = { layouts: state.layouts, unsent: state.unsent, deleted };
    AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => {});
  }
}

// the server lives on the host serving the app; `EXPO_PUBLIC_SERVER_URL` overrides it.
function serverUrl() {
  if (process.env.EXPO_PUBLIC_SERVER_URL) return process.env.EXPO_PUBLIC_SERVER_URL;
  const host =
    Platform.OS === 'web'
      ? globalThis.location?.hostname
      : Constants.expoConfig?.hostUri?.split(':')[0];
  return `ws://${host || 'localhost'}:${PORT}`;
}

let socket: WebSocket | undefined;
let attempt = 0;
let lastHeard = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let pingTimer: ReturnType<typeof setInterval> | undefined;

function send(message: ClientMessage) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function drop() {
  const ws = socket;
  socket = undefined;
  clearTimeout(retryTimer);
  clearInterval(pingTimer);
  if (ws) {
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    ws.close();
  }
}

function retry() {
  drop();
  set({ status: 'offline' }, false);
  // wait a little longer after each failure, up to 8 seconds.
  const delay = Math.min(8000, 500 * 2 ** attempt) * (0.5 + Math.random() / 2);
  attempt += 1;
  retryTimer = setTimeout(connect, delay);
}

function connect() {
  drop();
  let ws: WebSocket;
  try {
    ws = new WebSocket(serverUrl() + '/live');
  } catch {
    retry();
    return;
  }
  socket = ws;
  ws.onopen = () => {
    lastHeard = Date.now();
    pingTimer = setInterval(() => {
      // no word from the server for a while means the connection is dead.
      if (Date.now() - lastHeard > PING_MS * 2 + 5000) retry();
      else send({ type: 'ping' });
    }, PING_MS);
  };
  ws.onmessage = (event) => {
    lastHeard = Date.now();
    receive(JSON.parse(String(event.data)) as ServerMessage);
  };
  ws.onclose = retry;
  ws.onerror = () => {};
}

function receive(message: ServerMessage) {
  if (message.type === 'snapshot') {
    attempt = 0;
    // 1. anything deleted or edited here while offline goes up first.
    for (const id of deleted) send({ type: 'delete', id });
    deleted = [];
    for (const id of state.unsent) {
      if (state.layouts[id]) send({ type: 'put', layout: state.layouts[id] });
    }
    // 2. then take everything the server has that is newer than our copy.
    const layouts: Record<string, Layout> = {};
    for (const theirs of message.layouts) {
      const ours = state.layouts[theirs.id];
      layouts[theirs.id] = ours && isNewer(ours, theirs) ? ours : theirs;
    }
    // 3. keep our unsent layouts; anything else missing from the server was deleted elsewhere.
    for (const id of state.unsent) {
      if (state.layouts[id] && !layouts[id]) layouts[id] = state.layouts[id];
    }
    set({ layouts, status: 'live' });
  } else if (message.type === 'layout') {
    const theirs = message.layout;
    const ours = state.layouts[theirs.id];
    if (ours && isNewer(ours, theirs)) return;
    // the server has our edit (or something newer), so nothing is waiting to go up.
    set({
      layouts: { ...state.layouts, [theirs.id]: theirs },
      unsent: state.unsent.filter((id) => id !== theirs.id),
    });
  } else if (message.type === 'deleted') {
    const { [message.id]: _gone, ...layouts } = state.layouts;
    set({ layouts, unsent: state.unsent.filter((id) => id !== message.id) });
  }
}

/** saves an edit on this device and sends it when it can. */
export function saveLayout(layout: Layout) {
  set({
    layouts: { ...state.layouts, [layout.id]: layout },
    unsent: state.unsent.includes(layout.id) ? state.unsent : [...state.unsent, layout.id],
  });
  send({ type: 'put', layout });
}

export function deleteLayout(id: string) {
  const { [id]: _gone, ...layouts } = state.layouts;
  if (socket?.readyState === WebSocket.OPEN) send({ type: 'delete', id });
  else deleted = [...deleted, id];
  set({ layouts, unsent: state.unsent.filter((other) => other !== id) });
}

// read what was saved on this device, then go online.
AsyncStorage.getItem(KEY)
  .then((raw) => {
    const saved = raw ? JSON.parse(raw) : {};
    deleted = saved.deleted ?? [];
    state = { ...state, layouts: saved.layouts ?? {}, unsent: saved.unsent ?? [], ready: true };
  })
  .catch(() => {
    state = { ...state, ready: true };
  })
  .finally(() => {
    listeners.forEach((l) => l());
    if (typeof WebSocket !== 'undefined') connect();
  });

// coming back to the app, or the network coming back: don't wait out the retry timer.
AppState.addEventListener('change', (next) => {
  if (next === 'active' && state.ready && socket?.readyState !== WebSocket.OPEN) {
    attempt = 0;
    connect();
  }
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getState = () => state;

export function useSync() {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useLayout(id: string | undefined): Layout | undefined {
  const { layouts } = useSync();
  return id ? layouts[id] : undefined;
}

/** every layout, most recently changed first. */
export function sortedLayouts(layouts: Record<string, Layout>): Layout[] {
  return Object.values(layouts).sort((a, b) => b.updatedAt - a.updatedAt);
}
