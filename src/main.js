import * as THREE from 'three';
import {
  LOOP_DURATION,
  MAX_LOOPS,
  allObjectivesComplete,
  createInitialGameState,
  getSectorByRole,
} from './game/state.js';
import { sound } from './game/audio.js';
import { GameUI } from './game/ui.js';
import { AstronautPlayer } from './game/player.js';
import { StationLevel } from './game/level.js';
import { HazardSystem } from './game/hazards.js';

const container = document.getElementById('game-container');
const ui = new GameUI();

// Three.js Renderer, Scene & Third-Person Camera
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030611);
scene.fog = new THREE.FogExp2(0x040816, 0.015);

const camera = new THREE.PerspectiveCamera(
  54,
  window.innerWidth / window.innerHeight,
  0.1,
  180
);

// Build World
const level = new StationLevel(scene);
const player = new AstronautPlayer(scene);
const hazards = new HazardSystem(scene);

// Particle Burst & Volumetric Rocket Smoke System
const particles = [];
const smokePuffs = [];

function createSmokeTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  const grad = ctx.createRadialGradient(c, c, 4, c, c, c);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.85)');
  grad.addColorStop(0.45, 'rgba(225, 238, 255, 0.42)');
  grad.addColorStop(1.0, 'rgba(200, 220, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const smokeTexture = createSmokeTexture();

function spawnSmokePuff(pos, vx, vy, vz, scaleStart = 0.8, scaleEnd = 3.8, colorHex = 0xe2e8f0, life = 1.6) {
  const mat = new THREE.SpriteMaterial({
    map: smokeTexture,
    color: colorHex,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.position.copy(pos);
  sprite.scale.set(scaleStart, scaleStart, 1);
  scene.add(sprite);
  smokePuffs.push({
    sprite,
    mat,
    vx,
    vy,
    vz,
    scaleStart,
    scaleEnd,
    life,
    maxLife: life,
  });
}

function spawnBurst(pos, colorHex, count = 24) {
  const geo = new THREE.SphereGeometry(0.08, 6, 6);
  const mat = new THREE.MeshBasicMaterial({ color: colorHex });
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.position.y += 0.9;
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4.5;
    const vy = 1.5 + Math.random() * 4;
    scene.add(mesh);
    particles.push({
      mesh,
      vx: Math.cos(angle) * speed,
      vy,
      vz: Math.sin(angle) * speed,
      life: 0.65,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
      continue;
    }
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vy -= 9.8 * dt;
    const s = Math.max(0.05, p.life / 0.65);
    p.mesh.scale.setScalar(s);
  }

  for (let i = smokePuffs.length - 1; i >= 0; i--) {
    const s = smokePuffs[i];
    s.life -= dt;
    if (s.life <= 0) {
      scene.remove(s.sprite);
      s.mat.dispose();
      smokePuffs.splice(i, 1);
      continue;
    }
    const progress = 1 - s.life / s.maxLife;
    s.sprite.position.x += s.vx * dt;
    s.sprite.position.y += s.vy * dt;
    s.sprite.position.z += s.vz * dt;
    s.vx *= 0.96;
    s.vz *= 0.96;
    const size = s.scaleStart + (s.scaleEnd - s.scaleStart) * progress;
    s.sprite.scale.set(size, size, 1);
    s.mat.opacity = 0.72 * (1 - progress);
  }
}

// Game State, Echo Trail & Camera Shake
const ECHO_DURATION = 6.5;
let state = createInitialGameState();
let keypadBuffer = '';
let shakeIntensity = 0;
let elapsed = 0;
let launchTime = 0;
let launchSeated = false;
let launchClampsReleased = false;
let launchIgnited = false;
let launchBoostersSep = false;
let currentLoopTrail = [];
let previousLoopTrail = [];
let echoTimer = 0;

const cameraTarget = new THREE.Vector3();
const desiredCamPos = new THREE.Vector3();

function applyRunConfiguration(gameState) {
  const secSector = getSectorByRole(gameState.sectorAssignments, 'security');
  level.configureForRun(gameState);
  hazards.configureForRun(secSector, gameState.reactorRouteIndex);
}

applyRunConfiguration(state);

function recordTrailPoint(pos) {
  const last = currentLoopTrail[currentLoopTrail.length - 1];
  if (!last || Math.hypot(pos.x - last[0], pos.z - last[1]) >= 0.9) {
    currentLoopTrail.push([Number(pos.x.toFixed(2)), Number(pos.z.toFixed(2))]);
  }
}

// Input Tracking
const input = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

function clearMovementInput() {
  input.forward = false;
  input.backward = false;
  input.left = false;
  input.right = false;
}

// ==================== KEYPAD POP-UP LOGIC ====================
function openKeypad() {
  state.keypadOpen = true;
  keypadBuffer = '';
  clearMovementInput();
  sound.playTerminalActivate();
  ui.updateKeypadDisplay(keypadBuffer);
  ui.setScreens(state.phase, true);
}

function closeKeypad() {
  if (!state.keypadOpen) return;
  state.keypadOpen = false;
  keypadBuffer = '';
  ui.setScreens(state.phase, false);
}

function pushKeypadDigit(digit) {
  if (!state.keypadOpen || state.phase !== 'playing') return;
  if (keypadBuffer.length >= 4) return;
  keypadBuffer += String(digit);
  sound.playKeypadDigit(digit);
  ui.updateKeypadDisplay(keypadBuffer);
}

function clearKeypad() {
  if (!state.keypadOpen) return;
  keypadBuffer = '';
  sound.playButton();
  ui.updateKeypadDisplay(keypadBuffer);
}

function submitKeypad() {
  if (!state.keypadOpen || state.phase !== 'playing') return;
  if (keypadBuffer.length < 4) {
    sound.playError();
    ui.updateKeypadDisplay(keypadBuffer, 'ENTER ALL 4 DIGITS FIRST');
    return;
  }

  if (keypadBuffer === state.securityCodeValue) {
    state.memory.blastDoorUnlocked = true;
    closeKeypad();
    sound.playObjectiveComplete();
    shakeIntensity = 0.25;
    spawnBurst(new THREE.Vector3(0, 0, -15.5), 0x00ff9d, 30);
    ui.showToast(`CODE ${state.securityCodeValue} ACCEPTED! Blast Door permanently unlocked!`);
  } else {
    sound.playError();
    shakeIntensity = 0.12;
    keypadBuffer = '';
    ui.updateKeypadDisplay(keypadBuffer, 'ACCESS DENIED — INVALID CODE!');
  }
}

function handleManualRewind() {
  if (state.loopCount >= MAX_LOOPS) {
    sound.playError();
    ui.showToast('FINAL ATTEMPT (3/3) — Rewind disabled! Reach the Escape Rocket!', true);
    return;
  }
  triggerTimeRewind('MANUAL TEMPORAL REWIND', false);
}

// ==================== TIME REWIND ====================
function triggerTimeRewind(reason, isHazard = false) {
  if (state.phase !== 'playing') return;
  closeKeypad();
  state.mapOpen = false;

  // Enforce 3-attempt limit!
  if (state.loopCount >= MAX_LOOPS) {
    state.phase = 'gameover';
    sound.setMusicState(false, false);
    clearMovementInput();
    sound.playHazardImpact();
    shakeIntensity = 0.55;
    spawnBurst(player.group.position, 0xff3b5c, 32);
    ui.triggerRewindEffect('ANOMALY COLLAPSED', true);
    setTimeout(() => {
      ui.showGameOver(
        state,
        isHazard
          ? `${reason} on your final attempt (3/3).`
          : 'Your final 30-second loop expired before reaching the Escape Rocket.'
      );
    }, 450);
    return;
  }

  state.phase = 'rewinding';

  // Snapshot current loop trail so the next loop shows where you walked for a few seconds!
  previousLoopTrail = [...currentLoopTrail];
  currentLoopTrail = [];

  if (isHazard) {
    sound.playHazardImpact();
    shakeIntensity = 0.55;
  } else {
    shakeIntensity = 0.28;
  }
  sound.playRewind();

  spawnBurst(player.group.position, isHazard ? 0xff3b5c : 0xa855f7, 28);
  ui.triggerRewindEffect(reason, isHazard);
  const nextLoop = state.loopCount + 1;
  ui.showToast(
    nextLoop === MAX_LOOPS
      ? `FINAL ATTEMPT (${nextLoop}/${MAX_LOOPS})! Echo Trail shows your last path.`
      : isHazard
      ? `${reason} — Attempt ${nextLoop}/${MAX_LOOPS} started!`
      : `Loop Reset — Attempt ${nextLoop}/${MAX_LOOPS} (Echo Trail active)`,
    isHazard || nextLoop === MAX_LOOPS,
    3200
  );

  setTimeout(() => {
    if (state.phase !== 'rewinding') return;
    player.resetToSpawn();
    hazards.resetLoop();
    state.loopCount += 1;
    state.loopTimer = LOOP_DURATION;
    state.stabilizerCollectedThisLoop = false;
    state.boosterUsedThisLoop = false;
    state.lastCountdownBeep = -1;
    state.lastHeartbeatBeat = 0;

    // Activate 6.5s Echo Trail hint in 3D & Minimap
    echoTimer = previousLoopTrail.length >= 2 ? ECHO_DURATION : 0;
    level.setEchoTrail(previousLoopTrail);
    currentLoopTrail = [[player.spawnPos.x, player.spawnPos.z]];

    state.phase = 'playing';
    ui.setScreens('playing', false);
  }, 420);
}

// ==================== INTERACTIONS ====================
function handleInteract() {
  if (state.phase !== 'playing' || state.keypadOpen) return;
  const target = level.getNearestInteractable(player.group.position, state);
  if (!target) return;

  if (target.sectorId) {
    state.discoveredSectors[target.sectorId] = state.sectorAssignments[target.sectorId];
  }

  switch (target.id) {
    case 'telemetry': {
      if (state.memory.telemetryScanned) {
        sound.playButton();
        ui.showToast('Holo-Scanner already active in your left hand!');
        return;
      }
      state.memory.telemetryScanned = true;
      sound.playObjectiveComplete();
      shakeIntensity = 0.16;
      spawnBurst(target.position, 0x00f0ff, 26);
      ui.showToast('HOLO-SCANNER EQUIPPED! Mines & Safe Route revealed on floor and radar.');
      break;
    }
    case 'security': {
      if (state.memory.securityCodeFound) {
        sound.playButton();
        ui.showToast(`Cipher Chip in wrist holds code: ${state.securityCodeValue}`);
        return;
      }
      state.memory.securityCodeFound = true;
      sound.playObjectiveComplete();
      shakeIntensity = 0.16;
      spawnBurst(target.position, 0xa855f7, 26);
      ui.showToast(`CIPHER CHIP EQUIPPED! Code ${state.securityCodeValue} saved.`);
      break;
    }
    case 'keycard': {
      if (state.memory.keycardObtained) {
        sound.playButton();
        ui.showToast('Quantum Keycard already held in your right hand.');
        return;
      }
      state.memory.keycardObtained = true;
      sound.playObjectiveComplete();
      shakeIntensity = 0.16;
      spawnBurst(target.position, 0x00ff9d, 26);
      ui.showToast('QUANTUM KEYCARD EQUIPPED in your right hand!');
      break;
    }
    case 'booster': {
      if (state.boosterUsedThisLoop) {
        sound.playButton();
        ui.showToast('Temporal Relay cooling down until next loop.');
        return;
      }
      state.boosterUsedThisLoop = true;
      state.loopTimer = Math.min(LOOP_DURATION + 8, state.loopTimer + 8.0);
      sound.playTimeBonus();
      shakeIntensity = 0.14;
      spawnBurst(target.position, 0x38bdf8, 24);

      // Reveal one undiscovered decoy sector on the radar as bonus intel
      let revealedMsg = '+8.0s TEMPORAL BOOST!';
      for (const [sid, role] of Object.entries(state.sectorAssignments)) {
        if (role.startsWith('decoy') && !state.discoveredSectors[sid]) {
          state.discoveredSectors[sid] = role;
          revealedMsg = `+8.0s BOOST! Radar marked Sector ${sid} as DECOY.`;
          break;
        }
      }
      ui.showToast(revealedMsg);
      break;
    }
    case 'decoy1':
    case 'decoy2':
    case 'decoy3':
    case 'decoy4': {
      sound.playDecoyStatic();
      shakeIntensity = 0.1;
      spawnBurst(target.position, 0xff6622, 18);
      ui.showToast(
        `DECOY SECTOR (${target.sectorId}): Corrupted terminal — no mission intel here!`,
        true,
        2800
      );
      break;
    }
    case 'stabilizer': {
      if (state.stabilizerCollectedThisLoop) return;
      state.stabilizerCollectedThisLoop = true;
      state.loopTimer = Math.min(LOOP_DURATION + 5, state.loopTimer + 5.0);
      sound.playTimeBonus();
      spawnBurst(target.position, 0x00f0ff, 20);
      ui.showToast('+5.0s TEMPORAL STABILIZER ABSORBED!');
      break;
    }
    case 'blastdoor': {
      if (state.memory.blastDoorUnlocked) {
        sound.playButton();
        ui.showToast('Blast Door is already permanently unlocked.');
        return;
      }
      openKeypad();
      break;
    }
    case 'escapepod': {
      if (!allObjectivesComplete(state)) {
        sound.playError();
        shakeIntensity = 0.14;
        ui.showToast('ESCAPE POD LOCKED: Complete all 4 Memory Objectives first!', true);
        return;
      }
      state.phase = 'launching';
      ui.setScreens('launching', false, false);
      clearMovementInput();
      launchTime = 0;
      launchSeated = false;
      launchClampsReleased = false;
      launchIgnited = false;
      launchBoostersSep = false;
      sound.playRocketBoarding();
      break;
    }
  }
}

function startNewGameWithBriefing() {
  sound.playButton();
  sound.startMusic();
  sound.setMusicState(false, false);
  state = createInitialGameState();
  state.phase = 'briefing';
  keypadBuffer = '';
  launchTime = 0;
  launchSeated = false;
  launchClampsReleased = false;
  launchIgnited = false;
  launchBoostersSep = false;
  if (player.group.parent !== scene) {
    scene.add(player.group);
  }
  currentLoopTrail = [[player.spawnPos.x, player.spawnPos.z]];
  previousLoopTrail = [];
  echoTimer = 0;
  level.setEchoTrail([]);
  applyRunConfiguration(state);
  player.resetToSpawn();
  hazards.resetLoop();
  clearMovementInput();
  ui.setScreens('briefing', false);
}

function beginMissionFromBriefing() {
  if (state.phase !== 'briefing') return;
  sound.playButton();
  sound.startMusic();
  sound.setMusicState(true, false);
  state.phase = 'playing';
  clearMovementInput();
  ui.setScreens('playing', false);
  if (state.loopCount === 1 && state.totalTimeSpent < 0.2) {
    ui.showToast('LOOP #01 STARTED — Explore Sectors A–E! Press E to interact.');
  }
}

function openBriefingMidGame() {
  if (state.phase !== 'playing') return;
  clearMovementInput();
  closeKeypad();
  state.mapOpen = false;
  sound.playButton();
  state.phase = 'briefing';
  ui.setScreens('briefing', false, false);
}

function toggleMap() {
  if (state.phase !== 'playing' || state.keypadOpen) return;
  state.mapOpen = !state.mapOpen;
  clearMovementInput();
  sound.playButton();
  ui.setScreens('playing', false, state.mapOpen);
}

function toggleFullscreen() {
  sound.playButton();
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

function togglePause() {
  if (state.phase === 'playing') {
    if (state.keypadOpen) {
      closeKeypad();
      sound.playButton();
      return;
    }
    if (state.mapOpen) {
      state.mapOpen = false;
      sound.playButton();
      ui.setScreens('playing', false, false);
      return;
    }
    state.phase = 'paused';
    sound.setMusicState(false, false);
    clearMovementInput();
    sound.playButton();
    ui.setScreens('paused', false, false);
  } else if (state.phase === 'paused') {
    state.phase = 'playing';
    sound.playButton();
    ui.setScreens('playing', false, false);
  } else if (state.phase === 'briefing') {
    beginMissionFromBriefing();
  }
}

// ==================== KEYBOARD & UI BINDINGS ====================
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const code = e.code;

  if (state.phase === 'briefing') {
    if (code === 'Enter' || code === 'Space' || code === 'Escape') {
      e.preventDefault();
      beginMissionFromBriefing();
    }
    return;
  }

  if (state.keypadOpen && state.phase === 'playing') {
    if (e.key >= '0' && e.key <= '9') {
      pushKeypadDigit(e.key);
      return;
    }
    if (code === 'Backspace') {
      keypadBuffer = keypadBuffer.slice(0, -1);
      sound.playButton();
      ui.updateKeypadDisplay(keypadBuffer);
      return;
    }
    if (code === 'Enter') {
      submitKeypad();
      return;
    }
    if (code === 'Escape') {
      closeKeypad();
      sound.playButton();
      return;
    }
    return;
  }

  if (code === 'KeyW' || code === 'ArrowUp') input.forward = true;
  if (code === 'KeyS' || code === 'ArrowDown') input.backward = true;
  if (code === 'KeyA' || code === 'ArrowLeft') input.left = true;
  if (code === 'KeyD' || code === 'ArrowRight') input.right = true;

  if (code === 'KeyE') {
    handleInteract();
  } else if (code === 'KeyM') {
    toggleMap();
  } else if (code === 'KeyF') {
    toggleFullscreen();
  } else if (code === 'KeyR') {
    if (state.phase === 'playing') {
      handleManualRewind();
    } else if (state.phase === 'paused') {
      state.phase = 'playing';
      ui.setScreens('playing', false);
      handleManualRewind();
    }
  } else if (code === 'Escape') {
    togglePause();
  }
});

window.addEventListener('keyup', (e) => {
  const code = e.code;
  if (code === 'KeyW' || code === 'ArrowUp') input.forward = false;
  if (code === 'KeyS' || code === 'ArrowDown') input.backward = false;
  if (code === 'KeyA' || code === 'ArrowLeft') input.left = false;
  if (code === 'KeyD' || code === 'ArrowRight') input.right = false;
});

window.addEventListener('blur', clearMovementInput);

// Modal & HUD Buttons
document.getElementById('btn-start').addEventListener('click', startNewGameWithBriefing);
document.getElementById('btn-begin-loop').addEventListener('click', beginMissionFromBriefing);
document.getElementById('btn-hud-briefing').addEventListener('click', openBriefingMidGame);
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-pause-rewind').addEventListener('click', () => {
  state.phase = 'playing';
  ui.setScreens('playing', false);
  handleManualRewind();
});
document.getElementById('btn-pause-restart').addEventListener('click', startNewGameWithBriefing);
document.getElementById('btn-play-again').addEventListener('click', startNewGameWithBriefing);
document.getElementById('btn-retry-mission').addEventListener('click', startNewGameWithBriefing);
document.getElementById('hud-minimap-box').addEventListener('click', toggleMap);
document.getElementById('btn-hud-map').addEventListener('click', toggleMap);
document.getElementById('btn-hud-fullscreen').addEventListener('click', toggleFullscreen);
const audioBtn = document.getElementById('btn-hud-audio');
if (audioBtn) {
  audioBtn.addEventListener('click', () => {
    const muted = sound.toggleMute();
    audioBtn.textContent = muted ? '🔇' : '🔊';
  });
}
document.getElementById('btn-close-map').addEventListener('click', toggleMap);
document.getElementById('btn-hud-rewind').addEventListener('click', () => {
  if (state.phase === 'playing') {
    handleManualRewind();
  }
});

// Keypad Buttons
document.querySelectorAll('.kp-digit').forEach((btn) => {
  btn.addEventListener('click', () => pushKeypadDigit(btn.dataset.digit));
});
document.getElementById('kp-clear').addEventListener('click', clearKeypad);
document.getElementById('kp-enter').addEventListener('click', submitKeypad);
document.getElementById('kp-cancel').addEventListener('click', () => {
  closeKeypad();
  sound.playButton();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize Camera & Start Screen
camera.position.set(0, 11.5, 22);
camera.lookAt(0, 0.8, 13);
ui.setScreens('start', false);

// ==================== MAIN ANIMATION LOOP ====================
let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  elapsed += dt;

  if (state.phase === 'playing') {
    state.totalTimeSpent += dt;
    state.loopTimer -= dt;
    sound.setMusicState(true, state.loopTimer <= 10);

    if (echoTimer > 0) {
      echoTimer = Math.max(0, echoTimer - dt);
    }

    if (state.loopTimer <= 5 && state.loopTimer > 0) {
      const secCeil = Math.ceil(state.loopTimer);
      if (secCeil !== state.lastCountdownBeep) {
        state.lastCountdownBeep = secCeil;
        sound.playCountdownWarning();
      }
      state.lastHeartbeatBeat += dt;
      if (state.lastHeartbeatBeat >= 0.72) {
        state.lastHeartbeatBeat = 0;
        sound.playHeartbeat();
      }
    }

    if (state.loopTimer <= 0) {
      state.loopTimer = 0;
      triggerTimeRewind('TIME ANOMALY RESET', false);
    }

    if (!state.keypadOpen && !state.mapOpen) {
      player.update(dt, input, level.colliders, state.memory, elapsed);
      recordTrailPoint(player.group.position);
    } else {
      player.syncHeldClues(state.memory, elapsed);
    }

    const hazardResult = hazards.update(
      dt,
      state.memory.telemetryScanned,
      player.group.position,
      player.radius
    );
    if (hazardResult.hit) {
      triggerTimeRewind(hazardResult.reason, true);
    }
  } else if (state.phase === 'start' || state.phase === 'briefing') {
    hazards.update(dt, false, player.group.position, player.radius);
  } else if (state.phase === 'launching') {
    sound.setMusicState(false, false);
    launchTime += dt;
    const rocket = level.escapePodGroup;
    let stageLabel = 'BOARDING COCKPIT';
    let velKmS = 0;

    // Stage 1 (0.0s - 1.2s): Astronaut walks into cockpit seat & glass canopy seals
    if (launchTime < 0.72) {
      const t = Math.min(1, launchTime / 0.72);
      const seatWorld = new THREE.Vector3(0, 1.85, -37.38);
      player.group.position.lerp(seatWorld, Math.min(1, dt * 8));
      player.group.rotation.y += (0 - player.group.rotation.y) * Math.min(1, dt * 10);
      player.group.scale.setScalar(1 - t * 0.14);
    } else if (!launchSeated) {
      launchSeated = true;
      player.setSittingPose(true);
      player.group.scale.setScalar(0.86);
      player.group.position.set(0, 0, 0);
      player.group.rotation.set(0, 0, 0);
      level.pilotSeatAnchor.add(player.group);
      sound.playTerminalActivate();
    }

    if (launchTime >= 0.78 && launchTime < 1.5) {
      stageLabel = 'SEALING CANOPY';
      const cT = Math.min(1, (launchTime - 0.78) / 0.65);
      level.rocketCanopy.position.set(0, 3.15 - cT * 0.67, -0.45 + cT * 0.45);
      level.rocketCanopy.rotation.x = -0.65 * (1 - cT);
    }

    // Stage 2 (1.25s - 2.1s): Retract umbilical gantry clamps + cryogenic LOX vapor mist
    if (launchTime >= 1.25) {
      if (!launchClampsReleased) {
        launchClampsReleased = true;
        sound.playClampRelease();
      }
      const clampT = Math.min(1, (launchTime - 1.25) / 0.75);
      level.gantryArmLeft.rotation.y = -1.35 * clampT;
      level.gantryArmRight.rotation.y = 1.35 * clampT;
      if (launchTime < 2.1) {
        stageLabel = 'CLAMPS RELEASED // LOX VENT';
        if (Math.random() < 0.6) {
          const ang = Math.random() * Math.PI * 2;
          spawnSmokePuff(
            new THREE.Vector3(Math.cos(ang) * 0.7, 0.35, -37.5 + Math.sin(ang) * 0.7),
            Math.cos(ang) * 2.2,
            0.35,
            Math.sin(ang) * 2.2,
            0.65,
            2.4,
            0xdbeafe,
            1.1
          );
        }
      }
    }

    // Stage 3 (2.1s - 2.9s): Heavy Main + Side Booster Ignition & Billowing Pad Smoke
    if (launchTime >= 2.1 && !launchIgnited) {
      launchIgnited = true;
      sound.playEscapeLaunch();
    }

    if (launchTime >= 2.1) {
      level.escapePodFlame.visible = true;
      level.escapePodOuterFlame.visible = true;
      level.leftBoosterFlame.visible = !launchBoostersSep;
      level.rightBoosterFlame.visible = !launchBoostersSep;

      const flicker = 1 + Math.sin(elapsed * 52) * 0.22;
      level.escapePodFlame.scale.set(1, flicker, 1);
      level.escapePodOuterFlame.scale.set(1, flicker * 1.15, 1);
      level.leftBoosterFlame.scale.set(1, flicker, 1);
      level.rightBoosterFlame.scale.set(1, flicker, 1);
      level.escapePodLight.color.setHex(0xff9944);
      level.escapePodLight.intensity = 4.5;
    }

    if (launchTime >= 2.1 && launchTime < 3.45) {
      if (launchTime < 2.85) {
        stageLabel = 'MAIN ENGINE IGNITION';
        shakeIntensity = 0.28;
      } else {
        stageLabel = 'LIFTOFF // CLEARING TOWER';
        shakeIntensity = 0.32;
      }
      // Dense horizontal billowing exhaust clouds across launchpad floor!
      if (Math.random() < 0.92) {
        const ang = Math.random() * Math.PI * 2;
        const speed = 3.2 + Math.random() * 3.8;
        spawnSmokePuff(
          new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.3, -37.5 + (Math.random() - 0.5) * 0.8),
          Math.cos(ang) * speed,
          0.4 + Math.random() * 0.9,
          Math.sin(ang) * speed,
          1.1,
          4.6,
          Math.random() < 0.35 ? 0xffd7aa : 0xe2e8f0,
          1.5
        );
      }
    }

    // Stage 4 (2.75s - 8.2s): Realistic Inertia -> Gravity Turn -> Booster Sep -> Clean Orbital Flyby Past Earth!
    if (launchTime >= 2.75) {
      const flightT = Math.min(1, (launchTime - 2.75) / 5.45);
      const climbFrac = Math.pow(flightT, 1.85);
      const downrangeFrac = flightT > 0.2 ? Math.pow((flightT - 0.2) / 0.8, 1.35) : 0;

      // Arc cleanly up & right past Earth's sunlit horizon (Earth is at (-7, 46, -88), radius 16 -> ~22 units safe clearance!)
      rocket.position.x = Math.sin(flightT * Math.PI * 0.5) * 11.5;
      rocket.position.y = climbFrac * 45.5;
      rocket.position.z = -37.5 - downrangeFrac * 21.5;
      velKmS = flightT * 7.85;

      // Gravity turn + orbital horizon leveling
      if (rocket.position.y > 4.0) {
        const pitchT = Math.min(1, (rocket.position.y - 4.0) / 26.0);
        rocket.rotation.x = -0.92 * pitchT;
        rocket.rotation.z = -0.24 * pitchT;
      }

      if (flightT >= 0.28 && flightT < 0.48) {
        stageLabel = 'MAX-Q // SUPERSONIC';
        level.escapePodShockCone.visible = true;
      } else {
        level.escapePodShockCone.visible = false;
      }

      if (flightT >= 0.48) {
        if (!launchBoostersSep) {
          launchBoostersSep = true;
          sound.playBoosterSep();
          spawnSmokePuff(
            new THREE.Vector3(rocket.position.x - 1.5, rocket.position.y + 1.2, rocket.position.z),
            -2.4,
            -1.2,
            0.5,
            0.9,
            2.6,
            0xffffff,
            0.9
          );
          spawnSmokePuff(
            new THREE.Vector3(rocket.position.x + 1.5, rocket.position.y + 1.2, rocket.position.z),
            2.4,
            -1.2,
            0.5,
            0.9,
            2.6,
            0xffffff,
            0.9
          );
        }
        stageLabel = flightT < 0.72 ? 'BOOSTER SEPARATION' : 'ORBITAL INSERTION // EARTH';
        const sepT = Math.min(1, (flightT - 0.48) / 0.52);
        level.leftBoosterGroup.position.set(-1.45 - sepT * 5.2, -sepT * 7.5, sepT * 2.5);
        level.leftBoosterGroup.rotation.z = sepT * 0.95;
        level.rightBoosterGroup.position.set(1.45 + sepT * 5.2, -sepT * 7.5, sepT * 2.5);
        level.rightBoosterGroup.rotation.z = -sepT * 0.95;
      } else if (flightT >= 0.14 && stageLabel !== 'MAX-Q // SUPERSONIC') {
        stageLabel = 'GRAVITY TURN // ASCENDING';
      }

      // Gently throttle down flame as rocket settles smoothly into stable Earth orbit
      if (flightT > 0.85) {
        const throttle = Math.max(0.25, 1 - (flightT - 0.85) * 5);
        level.escapePodFlame.scale.setScalar(throttle);
        level.escapePodOuterFlame.scale.setScalar(throttle);
      } else if (Math.random() < 0.85) {
        spawnSmokePuff(
          new THREE.Vector3(
            rocket.position.x + (Math.random() - 0.5) * 0.35,
            rocket.position.y - 0.5,
            rocket.position.z + 0.6
          ),
          (Math.random() - 0.5) * 0.9,
          -1.8,
          0.9,
          0.95,
          3.2,
          0xdbeafe,
          1.15
        );
      }
    }

    ui.updateLaunchTelemetry(stageLabel, rocket.position.y * 4.8, velKmS);

    if (launchTime >= 8.3) {
      state.phase = 'victory';
      ui.showVictory(state);
    }
  }

  const echoAlpha = echoTimer > 0 ? Math.min(1, echoTimer / 2.2) : 0;
  level.updateEchoTrail(echoAlpha);
  level.update(dt, state, elapsed);
  updateParticles(dt);

  if (state.phase === 'launching' || state.phase === 'victory') {
    const rPos = level.escapePodGroup.position;
    if (state.phase === 'launching' && launchTime < 2.6) {
      desiredCamPos.set(3.2, 3.6, -31.2);
      cameraTarget.set(rPos.x, rPos.y + 2.25, rPos.z);
    } else {
      // Wide orbital camera framing both the sleek orbiting rocket AND Realistic Planet Earth cleanly!
      desiredCamPos.set(rPos.x + 7.5, rPos.y + 2.5, rPos.z + 10.5);
      if (level.earthGroup) {
        cameraTarget.set(
          rPos.x * 0.35 + level.earthGroup.position.x * 0.65,
          rPos.y * 0.35 + level.earthGroup.position.y * 0.65,
          rPos.z * 0.35 + level.earthGroup.position.z * 0.65
        );
      } else {
        cameraTarget.set(rPos.x, rPos.y + 4.2, rPos.z - 9.0);
      }
    }
    camera.position.lerp(desiredCamPos, Math.min(1, dt * 4.0));
  } else {
    const focusPos = player.group.position;
    desiredCamPos.set(focusPos.x, focusPos.y + 12.6, focusPos.z + 10.4);
    camera.position.lerp(desiredCamPos, Math.min(1, dt * 6.5));
    cameraTarget.set(focusPos.x, focusPos.y + 0.9, focusPos.z - 0.6);
  }

  if (shakeIntensity > 0.005) {
    camera.position.x += (Math.random() - 0.5) * shakeIntensity;
    camera.position.y += (Math.random() - 0.5) * shakeIntensity;
    shakeIntensity *= Math.pow(0.04, dt);
  } else {
    shakeIntensity = 0;
  }

  camera.lookAt(cameraTarget);

  const roomName = level.getRoomName(player.group.position, state);
  const nearest = level.getNearestInteractable(player.group.position, state);
  const promptText = nearest ? nearest.getPrompt(state) : null;

  ui.update(
    state,
    roomName,
    promptText,
    player.group.position,
    player.facingAngle,
    hazards.mines,
    hazards.safePoints,
    previousLoopTrail,
    echoAlpha
  );

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
