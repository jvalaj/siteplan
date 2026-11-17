# Siteplan

A layout tool for a construction crew. Dana lays out a space on site with her tape measure, and
Marcus sees it in the office as she works.

| Path         | What it is                                                           |
| ------------ | -------------------------------------------------------------------- |
| `src/app`    | The Expo app: the field editor (Dana) and the office viewer (Marcus) |
| `src/shared` | The layout model, geometry and formatting, used by app and server    |
| `server`     | A small Node server that stores layouts and pushes changes live      |
| `test`       | Tests for the geometry, the edits and the server's store             |

## Setup

You need **Node 22.13 or newer** (the server uses the built-in `node:sqlite`). No Docker, Xcode
or Android Studio.

```bash
npm install
npm run dev
```

`npm run dev` starts the sync server on port 4100 and the Expo dev server on port 8081.

- **Phone or tablet:** install Expo Go and sign in to an Expo account in it. Sign in on the
  computer too with `npx expo login` (current Expo Go requires both). Put the device on the same
  Wi-Fi as the computer and scan the QR code in the terminal. The device needs to reach ports
  8081 and 4100.
- **Browser:** press `w` in the terminal, or open http://localhost:8081.

The app uses Expo SDK 58, the version the current Expo Go supports. Everything it uses ships
inside Expo Go, so no development build is needed.

If your network blocks device-to-device traffic, `npm run dev -- --tunnel` tunnels the Expo dev
server. You would also need to expose port 4100 and set `EXPO_PUBLIC_SERVER_URL` (for example
`ws://your-host:4100`) before starting.

## Trying it

Open the app on two devices (or a phone and a browser).

1. On one, tap **Office**. This is Marcus.
2. On the other, tap **Field**, then **Room**, **Deck** or **Patio**. This is Dana.
3. Tap **Read** four times. Each press stands in for the button on Dana's Bluetooth tape. The
   walls draw themselves, and a four-sided space closes by itself.
4. Tap **Add**, pick Door or Window, and tap **Read** twice: once for the distance from the
   corner, once for the width.
5. Tap **Size** to pin a height or depth to a wall, with the tape or calipers.
6. Watch the office device: every change shows up as it happens. Pinch, drag, or use the zoom
   buttons, and tap any wall or feature to inspect it.
7. Turn off Wi-Fi on the field device and keep working. It says "Saved on phone" and
   catches the office up when the connection returns.

On an iPad held sideways or a Mac browser, Office keeps the plan list on the left and lists
every wall beside the plan.

### Keyboard (Mac / browser)

| Field | | Office | |
| --- | --- | --- | --- |
| `R` | read | `←` `→` | step through walls |
| `T` | type a number (then digits, `F`/`'` feet, `I`/`"` inches, `Enter`) | `+` `-` `0` | zoom in, out, fit |
| `1` `2` `3` | Walls, Add, Size | `U` | swap ft / mm |
| `←` `→` | turn left / right, or change wall | `Esc` | back to the whole plan |
| `⌘Z` | undo | | |

## Other scripts

| Command             | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run server`    | Sync server only (restarts on change) |
| `npm run app`       | Expo dev server only                  |
| `npm test`          | Tests                                 |
| `npm run typecheck` | TypeScript                            |
| `npm run lint`      | ESLint                                |

Layouts are stored in `server/data/siteplan.db`. Delete that file to start fresh.
