# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

No build step. Start any static server and open in browser:

```bash
# Python 3
python3 -m http.server 8000

# Node.js
npx serve .

# macOS (direct file)
open index.html
```

Then navigate to `http://localhost:8000` or open `index.html` directly.

## Project Structure

Minimal vanilla JS project—three files:

- **index.html**: DOM structure, two `<canvas>` elements (board 300×600px, next-piece preview 120×120px), sidebar panel with score/lines/level HUD
- **style.css**: Dark retro-arcade theme with flexbox layout, no dependencies
- **game.js**: ~300 lines, all game logic; `'use strict'`

## Architecture Overview

**Board model**: 2D array `board[row][col]` where each cell holds `0` (empty) or a color index (1–7).

**Pieces**: 7 standard Tetris pieces stored as 4×4 matrices in `PIECES` array. Piece state: `{ type, shape, x, y }` where `shape` is a deep copy allowing rotation without mutating the template.

**Core game loop** (`loop()` via `requestAnimationFrame`):
1. Accumulate elapsed time
2. When `dropAccum >= dropInterval`, attempt to lower piece or lock it
3. Render board + ghost piece + current piece + grid
4. Schedule next frame

**Key functions**:
- `collide(shape, ox, oy)`: Detects if shape at offset hits boundary or occupied cells
- `rotateCW(shape)`: 90° clockwise via transpose + row reversal
- `tryRotate()`: Rotate with wall-kick fallback (tries offsets: 0, ±1, ±2)
- `merge()`: Copy current piece into board
- `clearLines()`: Scan bottom-up, splice full rows, inject empty row at top
- `ghostY()`: Raycast downward to find landing position
- `lockPiece()`: Merge, clear lines, spawn next
- `spawn()`: Move `next → current`, generate new `next`, check for game over
- `hardDrop()` / `softDrop()`: Instant/1-row drop with score multipliers

**Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` × level. Hard drop: 2 pts/row. Soft drop: 1 pt/row. Level increments every 10 lines; speed increases via `dropInterval = max(100, 1000 − (level−1)×90)`.

## Tunable Constants

All in `game.js` top section:

| Constant | Default | Purpose |
|----------|---------|---------|
| `COLS` | 10 | Board width |
| `ROWS` | 20 | Board height |
| `BLOCK` | 30 | Pixel size of one cell |
| `COLORS` | 7 hex colors | Piece color palette |
| `LINE_SCORES` | `[0,100,300,500,800]` | Points per 1–4 lines |

> If adjusting `COLS`, `ROWS`, or `BLOCK`, also update canvas dimensions in `index.html` to `COLS×BLOCK` and `ROWS×BLOCK`.

## Input Handling

Keydown listener triggers movement/rotation/pause; no debouncing (grid-based input naturally throttled by game loop). Pause state bypasses movement inputs but allows P to resume. Game over state allows only restart click.

## HTML5 Canvas

Two contexts in use:
- `board`: Main playfield, drawn every frame (grid + locked blocks + ghost + current)
- `next-canvas`: Next piece preview, redrawn on spawn; centered via manual offset calculation

No image assets or external rendering libraries; all fills/strokes via Canvas 2D context.

## Common Development Tasks

**Change board size**: Update `COLS` / `ROWS` in game.js AND canvas dimensions in index.html.

**Adjust piece colors**: Edit `COLORS` array (index 0 unused, indices 1–7 map to piece types).

**Tweak scoring**: Modify `LINE_SCORES` array or level multiplier in `clearLines()`.

**Change piece speed**: Adjust `dropInterval` formula in `clearLines()` or initial value in `init()`.

**Add new piece or modify existing**: Edit `PIECES` array (4×4 matrices; bounding box handled by rotation logic).

## Testing Locally

Open in browser, play a game. Check:
- Piece rotation doesn't glitch at edges (wall-kick should nudge it)
- Ghost piece aligns with hard-drop position
- Lines clear and level increments every 10 lines
- Pause overlay appears and game resumes correctly
- Game over triggers when new piece spawns in collision
