# Reaction Timer — Portfolio Grade (Three.js)

A fast, minimal **reaction time test** built as a **single static `index.html`** (no build tools, no frameworks).  
It pairs a **high-precision timing core** (`performance.now()`) with a lightweight **Three.js WebGL scene** for a polished, modern feel—without letting visuals interfere with measurement accuracy.

## Demo
- Open `index.html` locally in a browser, or deploy as-is to any static host (GitHub Pages, Netlify, Vercel static, S3, etc.).

---

## Features

### Core gameplay
- **Randomized start delay** (1–5 seconds) to prevent anticipation.
- **False start detection**: clicking during the “WAIT” phase triggers **Too early**.
- **High-resolution timing** using `performance.now()` for reaction measurement.

### Stats & persistence
- **Best time (persisted)** via `localStorage` (`rtg_best_ms_v1`).
- **Average time (session)** over the last 10 attempts.
- **Attempts history**: shows the **last 10** results (most recent first).
- **Reset session**: clears attempts and session stats (best remains).
- **Clear best**: removes persisted best time from storage.

### UX & accessibility
- **Keyboard support**: `Space` / `Enter` behaves like click.
- **ARIA live region** announces state changes and results.
- **Responsive layout**: touch-friendly, mobile-first UI.
- Clear visual states: `idle → waiting → ready → result` (+ `too_early`).

### Three.js visuals (background inside the arena)
- WebGL canvas is rendered **inside the clickable game arena** (behind UI).
- State-driven visual behavior:
  - **waiting** → red-emphasis / calmer motion
  - **ready** → green-emphasis / higher energy motion
  - **too_early** → jitter / red flash feel
  - **result** → settles back down
- Uses simple geometry (torus knot + icosahedron + satellites) with efficient `requestAnimationFrame` loop.

---

## How to Play
1. Click **Click to start** (or press **Space/Enter**).
2. **Wait** during the red phase.
3. When the panel becomes **green / GO**, click as fast as you can.
4. Your reaction time is recorded in milliseconds.

---

## Reaction Time Scale
The UI labels results using the following thresholds:
- **Amazing**: `< 150 ms`
- **Very Good**: `150–200 ms`
- **Good**: `200–250 ms`
- **Average**: `250–350 ms`
- **Below Average**: `> 350 ms`

> Note: These ranges are general and meant for playful feedback.

---

## Project Structure (Single File)
Everything is intentionally contained in one file:

- **HTML**: layout, accessibility hooks, modal
- **CSS**: modern dark theme, state overlays, responsiveness
- **JS**: organized into small modules:
  - `Storage`: persisted best score
  - `Stats`: last 10 attempts + session average
  - `UI`: render functions + ARIA announcements
  - `Visuals3D`: Three.js scene + state-driven animation
  - `Game`: finite state machine + timing logic
  - `HowToPlay`: one-time modal (stored in localStorage)

---

## Finite State Machine
The game uses a simple, explicit state machine:

- `idle` — ready to start
- `waiting` — randomized delay running (clicking here is a false start)
- `ready` — measure reaction time from `readyAt` to click
- `too_early` — user clicked early; retry prompt
- `result` — show measured time; click to play again

This keeps behavior predictable and prevents race conditions (e.g., double clicks, stale timers).

---

## Timing Accuracy
Timing is measured with:

- `performance.now()` for both `readyAt` and click timestamps
- A randomized delay (`setTimeout`) to transition into the `ready` state

The Three.js animation loop is **separate** from the timing logic to avoid skewing measurements.

---

## Persistence (localStorage keys)
- Best time: `rtg_best_ms_v1`
- How-to-play shown flag: `rtg_how_to_play_shown_v1`

---

## Run Locally
No dependencies to install.

### Option A: Open directly
- Double-click `index.html`

### Option B: Local server (recommended)
Some browsers enforce stricter policies when opened via `file://`.  
Use any simple static server:

```bash
# Python
python -m http.server 8080

# Node (if installed)
npx serve .