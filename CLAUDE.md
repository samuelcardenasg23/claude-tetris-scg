# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris in vanilla JavaScript + HTML5 Canvas. No dependencies, no build step, no package.json, no tests, no linter. The README is in Spanish, as is the in-game UI text (keep that language for user-facing strings).

## Running

Open `index.html` directly, or serve statically (e.g. `python3 -m http.server 8000` and visit `http://localhost:8000`).

## Architecture

Three files, all loaded by `index.html` (`game.js` via a plain `<script>`, not a module):

- `index.html` — fixed DOM: `#board` canvas (300×600 = 10×20 cells at 30px), `#next-canvas` (120×120), HUD spans (`#score`, `#lines`, `#level`), and the `#overlay` used for both pause and game over.
- `style.css` — layout/theme; the overlay is toggled via the `hidden` class.
- `game.js` — all logic, in one file using top-level globals (`board`, `current`, `next`, `score`, ...), reset in `init()`.

### game.js key points

- **Piece encoding**: piece type is 1–12 and the same number is stored in the shape matrices, in `board` cells, and as the index into `COLORS`. `0` means empty. 1–7 are the standard tetrominoes (I,O,T,S,Z,J,L); 8–10 and 12 are special pieces (`+`, U, Y pentominoes and a hollow 3×3 ring) that `randomPiece()` picks with `SPECIAL_CHANCE`; 11 is the 1×1 reward piece, only spawned after a 4-line clear (`clearLines()` replaces `next` with it). Adding a piece requires updating `PIECES`, `COLORS`, and the matching `STANDARD_TYPES`/`SPECIAL_TYPES` list. Types 13–17 are one-cell power-ups (bomb, lightning, dye, gravity, freeze; see `POWER_BY_TYPE`): they are never merged into `board`, `lockPiece()` calls `applyPower()` at the landing cell instead. Every `POWERUP_EVERY` (10) lines `powerPending` makes the piece after `next` a random power-up. Board value 18 (`WILD`) is the wildcard left by the dye: `rowComplete()` lets each wildcard cover one empty cell of its row. Freeze is a `freezeLeft` ms counter consumed in `loop()` (gravity paused). Previews (`drawPreview`) centre and scale any shape, so shapes are not limited to 4×4.
- **Skills**: `energy` (0–100, +10 per cleared line in `clearLines()`) is spent with keys 1–4 via `useSkill()` (costs in `SKILLS`): peek (`peekCount` placements showing `[next, ...queue]` in the NEXT canvas), swap (random other standard piece), slow (`slowLeft` ms, gravity interval ×2 in `loop()`) and undo (restores the `undoSnap` taken at the start of `lockPiece()`; single level). Upcoming pieces live in `queue` (5 pieces after `next`, refilled by `fillQueue()`); `spawn()` shifts from it. Hold (C/Shift) is the free "reserve" skill. HOLD canvas is in the left panel.
- **Modes**: `mode` is `'classic'` or a key of `CHALLENGES` (sprint, survival, fixed, invisible, reverse); buttons in the left panel (`data-mode`) call `setMode()`, which re-runs `init()`. Challenges are "pure rules": `isChallenge()` disables skills, power-ups, special pieces and the 1×1 reward. `tickChallenge(dt)` (called from `loop()`) runs the countdown `timeLeft` and the garbage timer; `checkObjective()` (end of `clearLines()`) detects line/clear-board victories; `endGame(title, win)` shows victory or defeat. `levelBase` offsets the level (reverse starts at 5); `reverseRotation()` flips `tryRotate()` from `REVERSE_FROM_LEVEL`; in `invisible` `draw()` hides `board` except for `REVEAL_MS` after each lock.
- **Pause menu**: `P`/`Escape` call `togglePause()`, which opens `#pause-menu` (separate from `#overlay`, which stays for game over; Escape does nothing in game over). Code lives in the `// ---- Menú de pausa ----` section: Reanudar, Reiniciar (`init()`), Ver controles toggle, and a 1–10 `<select>` stored in global `startLevel` + `localStorage` `startLevel`, applied in `init()` (`levelBase = cfg?.startLevel ? ... : startLevel - 1`) so it affects the next game. While paused the `keydown` handler only processes P/Escape and `pauseMenuKey()` (arrow navigation). On resume `swallowHeld` drops auto-repeat keydowns until the first keyup, and `dropAccum`/`lastTime` are reset.
- **Game loop**: `requestAnimationFrame` `loop(ts)` accumulates time into `dropAccum` and gravity-drops when it exceeds `dropInterval`. Input is handled separately in a `keydown` listener (no DOM events drive gravity). Pause/game-over stop the loop via `cancelAnimationFrame(animId)`; unpausing resets `lastTime` and restarts `loop`.
- **Flow**: `lockPiece()` → `merge()` → `clearLines()` (updates lines/score/level/`dropInterval`) → `spawn()` (promotes `next`, game over if the new piece collides immediately).
- **Rotation**: `rotateCW` + `tryRotate` with simple horizontal wall kicks `[0,-1,1,-2,2]` (no SRS tables).
- **Scoring**: `LINE_SCORES` × level; soft drop +1/cell, hard drop +2/cell. Level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Rendering**: `draw()` repaints the whole board each frame (grid, locked cells, ghost at alpha 0.2 via `ghostY()`, current piece). `drawBlock` is shared by the main and next-piece canvases.
