// the sync server. it does three things: keeps the newest copy of every layout in a sqlite
// file, sends every connected device the full set when it connects, and passes each change
// on to everyone else straight away.
//
// run it with `npm run server`. it needs node 22.13 or newer for the built-in sqlite.

import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { WebSocket, WebSocketServer } from 'ws';

import type { ClientMessage, Layout, ServerMessage } from '../src/shared/layout';
import { createStore } from './store';

const PORT = Number(process.env.SITEPLAN_PORT ?? 4100);
const DB_PATH =
  process.env.SITEPLAN_DB ?? join(dirname(fileURLToPath(import.meta.url)), 'data/siteplan.db');

mkdirSync(dirname(DB_PATH), { recursive: true });
const store = createStore(new DatabaseSync(DB_PATH));

const server = createServer((req, res) => {
  // two plain http routes, handy for checking the server from a browser or curl.
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/health') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.url === '/layouts') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(store.all()));
    return;
  }
  res.statusCode = 404;
  res.end('Not found');
});

const wss = new WebSocketServer({ server, path: '/live', maxPayload: 1024 * 1024 });
// the http server's own handler below reports listen errors; without this they would be thrown
// a second time from here.
wss.on('error', () => {});

const lastHeard = new Map<WebSocket, number>();

function send(socket: WebSocket, message: ServerMessage) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function broadcast(message: ServerMessage) {
  for (const socket of wss.clients) send(socket, message);
}

function isLayout(value: unknown): value is Layout {
  const l = value as Layout;
  return (
    !!l &&
    typeof l.id === 'string' &&
    typeof l.name === 'string' &&
    Number.isInteger(l.rev) &&
    Array.isArray(l.walls) &&
    Array.isArray(l.features) &&
    Array.isArray(l.measurements)
  );
}

wss.on('connection', (socket) => {
  lastHeard.set(socket, Date.now());
  send(socket, { type: 'snapshot', layouts: store.all() });

  socket.on('message', (data) => {
    lastHeard.set(socket, Date.now());
    let message: ClientMessage;
    try {
      message = JSON.parse(String(data));
    } catch {
      return;
    }

    if (message.type === 'ping') {
      send(socket, { type: 'pong' });
    } else if (message.type === 'put' && isLayout(message.layout)) {
      const saved = store.put(message.layout);
      if (saved === message.layout) {
        // it was newer than what we had: tell everyone, the sender included, so the sender
        // knows it has been saved.
        broadcast({ type: 'layout', layout: saved });
      } else {
        // we already had a newer copy. send that back so the sender catches up.
        send(socket, { type: 'layout', layout: saved });
      }
    } else if (message.type === 'delete' && typeof message.id === 'string') {
      store.remove(message.id);
      broadcast({ type: 'deleted', id: message.id });
    }
  });

  socket.on('close', () => lastHeard.delete(socket));
  socket.on('error', () => socket.terminate());
});

// devices ping every 15 seconds. one that has been silent for 45 has gone away without saying
// so (no signal, flat battery), so stop holding its connection open.
setInterval(() => {
  const cutoff = Date.now() - 45_000;
  for (const [socket, heard] of lastHeard) {
    if (heard < cutoff) socket.terminate();
  }
}, 5_000);

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or set SITEPLAN_PORT.`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n!.address);
  console.log(`Siteplan server ready on port ${PORT}`);
  for (const address of addresses)
    console.log(`  phones and tablets reach it at ${address}:${PORT}`);
});
