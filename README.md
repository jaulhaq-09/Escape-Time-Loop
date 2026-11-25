# ESCAPE THE TIME LOOP: YOU HAVE ONLY 30 SECONDS

**Every loop resets the station. Nothing resets your memory.**

Built for **Cosmic Jam (Theme: Space & Galaxies)** as a genuine 3D browser puzzle-adventure game using **Three.js**, **JavaScript (ES Modules)**, **HTML5/CSS3**, **HTML5 2D Canvas**, **Web Audio API**, and **Vite**.

## Key Features
- **3 Attempts × 30-Second Time Loop**: You have **3 attempts** of 30 seconds each. Every reset returns you to `[S] Cryo-Pod Bay`, while your **Memory Core**, **Discovered Sectors**, **Echo Trail**, and **In-Hand Gear** persist across loops.
- **Randomized 8-Sector Layout (`A–H`)**: Every new game shuffles **Research Lab** (Telemetry Scanner), **Security Core** (4-Digit Override Code behind a periodic laser gate), **Medical Bay** (Quantum Keycard), **Temporal Relay** (`+8s` boost + decoy scan), and **4 Decoy Rooms**—all styled in uniform cyan until inspected with `E`.
- **In-Hand 3D Clues**: Equipping the **Holo-Scanner** (left hand), **Security Cipher Chip** (left wrist), and **Quantum Keycard** (right hand) displays glowing 3D gear directly on the astronaut.
- **Circular Top-Right Radar & `[M]` Full Map**: Shows all rooms, `S` (Start), `E` (Escape Rocket), live player position/facing arrow, and a **6.5-second Echo Trail** of your previous loop's path after each reset.
- **Tactical Obstacles & Hazards**: Dodge **3 patrolling security drones**, **2 periodic corridor plasma vents**, **solid corridor pylons & interior cover barricades**, **hidden plasma mines**, **reactor radiation zones**, and **periodic laser gates**.
- **Manual Keypad & Escape Rocket to Earth**: Enter your 4-digit code manually in the Blast Door Keypad, cross the Reactor Safe Route, sit inside the Escape Rocket cockpit, launch past booster separation, and fly into orbit past a procedural 3D **Planet Earth**.
- **Procedural Sci-Fi Soundtrack & SFX**: Dynamic Web Audio synth music + sound effects with a HUD mute toggle (`🔊`/`🔇`).

## Controls
- **W / A / S / D** (or Arrow Keys) — Move astronaut
- **E** — Inspect terminals, equip clues, open Blast Door Keypad, absorb `+5s` Stabilizer, or launch Escape Rocket
- **0–9 / Enter / Backspace** — Type override code in the Blast Door Keypad
- **M** — Toggle Full Tactical Station Map
- **F** — Toggle Fullscreen Mode
- **R** — Manual Time Rewind (Attempts 1 & 2)
- **ESC** — Close Pop-ups / Pause Mission

## Run Locally
```bash
npm install
npm run dev
```

## Production Build
```bash
npm run build
npm run preview
```

## Credits & Originality
- All 3D geometry, procedural Earth & space textures, radar map, keypad UI, gameplay logic, and Web Audio music/sound effects were built from scratch in this repository with no pre-built game templates or external asset downloads.
