# notes

## key interaction decisions, and why

**dana measures, and the app draws.** she never draws lines with her finger. she takes a tape reading, and a wall of that length appears. drawing by hand needs a steady bare finger, but she wears gloves and works in sun and rain. the tape is her most accurate tool, so i made it the main input.

**the controls feel like hardware.** everything is big keys in one dark frame, like a remote. keys in a row are the same size and have a picture. color shows what a key does: grey for choices, white for tools, navy for the main action (read), and reekon yellow for whatever is on.

**the app always says what the next reading will do.** a "next" display shows something like "wall 3 · turn right", so dana can press the tape button without looking. the app also guesses: the next wall turns the same way as the last, so a rectangle is four tape presses and no taps. when the last wall reaches the start, the shape closes by itself.

**the gap is shown, not hidden.** readings never add up perfectly, so the plan shows how far the end is from the start. a small gap closes quietly. a big gap means a wall is missing, so "close shape" adds a dashed "worked out" wall until someone measures it.

**doors and windows take two readings:** distance from the corner, then width. the starting corner is marked yellow with an arrow, so a door never lands at the wrong end. picking a door opens the keypad by itself for both numbers, so nothing is missed.

**out of order gets a warning.** if she tries to add a door before any wall exists, the "next" display turns red with a "!" and tells her what to do first.

**every animation has a reason.** new walls draw out from their corner, the plan glides when it re-fits, and results drop in from the top, green when it worked and red when something needs a look. reduce motion turns it all off.

## how it fits dana and marcus

**dana (gloves, sun, rain, 3–5 spaces a day)**
- keys are 68–84 points tall; apple's minimum is 44.
- every tap buzzes and ticks, so she knows it worked without looking.
- the field screen is always black on white, because dark screens are hard to read outside.
- it works offline. edits save on the phone first and sync later.
- undo says what it undid, since wet screens cause wrong taps.
- tapping a wall or door shows a remove key. removing a wall leaves a visible gap instead of breaking the shape.
- pinch or the zoom keys get into a tight corner, and fit brings the whole plan back.
- rename and delete sit in the "…" menu, and delete asks first.
- on an ipad held sideways, the controls become one tall panel: next on top, every wall in the middle, keys at the bottom near her thumbs.

**marcus (ipad or mac, quotes and cut lists)**
- the plan updates live and highlights what dana just changed.
- he can pinch, drag, use the trackpad, or the zoom keys.
- the panel shows area, perimeter, and wall length minus openings (for trim and railing), with no scrolling.
- on a big screen, plans stay listed on the left like mail, and every wall is listed beside the plan. that is basically his cut list.
- on a mac, arrows step through walls, + and - zoom, and u switches units. dana gets shortcuts too (r reads, t types).

## packages

- `react-native-svg` draws the plan, sharp at any zoom and tappable.
- `expo-haptics` and `expo-audio` give the buzz and sound on each key.
- `expo-keep-awake` keeps the screen on while measuring.
- `async-storage` saves plans on the phone for offline work.
- `ws` and node's built-in `node:sqlite` make the sync server, one command, no docker.

**rejected:** skia, because a plan is only a few dozen shapes. reanimated and gesture-handler, because the built-in `PanResponder` and `Animated` work the same in expo go and the browser. a bluetooth library, because expo go can't load its native code, so "read" is a labelled simulated button and a real tape only needs one file changed. a crdt, because one person edits a plan at a time, so newest version wins is enough.

## what i cut, and what's next

**cut:** real bluetooth, two people editing one plan, angles other than 90° and 45°, sign-in, android testing, and full large-text support.

**next week:** a development build with a real bluetooth tape, spoken read-back so dana doesn't need to look, a cut list export for marcus, photos pinned to walls, and merging for two editors.
