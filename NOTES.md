# notes

## key interaction decisions

**dana measures, the app draws.** she never drags lines with her finger. she takes a tape reading and a wall shows up at that length. drawing by hand needs a steady bare finger, and she's wearing gloves in the sun. the tape is already her most precise tool, so i made it the input.

**the controls look like hardware.** one block of big keys in a dark frame, same size per row, each with a picture. color tells you what a key is: grey for choices, light for tools, navy for the main action (read), and reekon yellow for whatever is switched on. nothing small to aim at.

**the app always says what the next reading does.** a bar on the plan reads "wall 3 · turn right", so she can hit the tape button without looking and trust where the number goes. it also guesses: the next wall turns the same way as the last, so a plain rectangle is four tape presses and zero taps. when the last wall reaches the start, the shape closes itself.

**the gap is shown, not hidden.** readings never add up perfectly, so the plan shows how far off the start you are. a tiny gap closes quietly. a big one means a wall is missing, so "close shape" adds a dashed "worked out" wall until someone measures it.

**features take two readings:** distance from the corner, then width. the starting corner is marked yellow with an arrow, so a door never ends up at the wrong end of the wall.

**animations have a job.** new walls draw out from their corner so you see which way they went, the plan glides when it re-fits so you don't lose your place, and results drop in from the top and leave. reduce motion turns all of it off.

## how it fits dana and marcus

**dana (gloves, sun, rain, 3–5 spaces a day)**
- keys are 68–84pt tall (apple's minimum is 44)
- every tap buzzes and ticks so she knows it worked. a reading landing gets a stronger buzz. sounds follow the silent switch
- black on white with thick lines for direct sun. the editor stays light even in dark mode
- works with no signal: edits save on the phone first and sync later
- undo says what it undid, since wet screens cause stray taps
- the screen stays awake, the keys fold away to show the whole plan, and delete hides behind a menu and asks first
- voiceover reads every wall and feature

**marcus (ipad, quotes and cut lists)**
- the plan updates live and highlights what dana just changed
- pinch, drag, or use the zoom and fit keys
- everything fits on one screen, no scrolling: area, perimeter, wall run minus openings (for trim and railing), and keys to step wall by wall in both units

## packages
- `react-native-svg`: the plan. stays sharp at any zoom and gives me tap targets
- `expo-haptics`, `expo-audio`: buzz and sound on every key
- `expo-keep-awake`: screen stays on in the editor
- `async-storage`: offline saves
- `ws` + node's built-in `node:sqlite`: the sync server. one command, no docker

**rejected:** skia (faster, but a plan is a few dozen shapes), reanimated/gesture-handler (built-in `PanResponder` and `Animated` work the same in expo go and the browser), a bluetooth library (needs native code expo go doesn't have, so "read" is a labelled simulated button and readings come in as events, so a real tape only swaps one file), and a crdt (one person edits at a time, so newest version wins is enough).

## what i cut, and what's next

**cut:** real bluetooth, two people editing the same plan, angles other than 90° and 45°, sign-in, renaming plans, android testing, and full large-text support.

**next week:** a dev build with a real bluetooth tape, spoken read-back so dana doesn't need to look at all, a cut list and materials export for marcus, photos pinned to walls, and proper merging for two editors.
