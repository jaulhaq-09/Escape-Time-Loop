import { LOOP_DURATION, MAX_LOOPS, getCurrentMissionHint, getSectorByRole } from './state.js';
import { MinimapRenderer } from './minimap.js';

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const mins = String(Math.floor(s / 60)).padStart(2, '0');
  const secs = String(s % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

export class GameUI {
  constructor() {
    this.hud = document.getElementById('hud');
    this.startScreen = document.getElementById('start-screen');
    this.briefingModal = document.getElementById('briefing-modal');
    this.pauseScreen = document.getElementById('pause-screen');
    this.victoryScreen = document.getElementById('victory-screen');
    this.gameoverScreen = document.getElementById('gameover-screen');
    this.keypadModal = document.getElementById('keypad-modal');
    this.mapModal = document.getElementById('map-modal');

    this.loopCountEl = document.getElementById('loop-count');
    this.timerBox = document.getElementById('timer-box');
    this.timerValueEl = document.getElementById('timer-value');
    this.timerBarFill = document.getElementById('timer-bar-fill');
    this.totalTimeEl = document.getElementById('total-time');

    this.memTelemetry = document.getElementById('mem-telemetry');
    this.memTelemetryDesc = document.getElementById('mem-telemetry-desc');
    this.memCode = document.getElementById('mem-code');
    this.memCodeDesc = document.getElementById('mem-code-desc');
    this.memKeycard = document.getElementById('mem-keycard');
    this.memKeycardDesc = document.getElementById('mem-keycard-desc');
    this.memBlastdoor = document.getElementById('mem-blastdoor');
    this.codeChip = document.getElementById('security-code-chip');
    this.hudCodeValue = document.getElementById('hud-code-value');

    this.gearScanner = document.getElementById('gear-scanner');
    this.gearCipher = document.getElementById('gear-cipher');
    this.gearKeycard = document.getElementById('gear-keycard');

    this.currentRoomEl = document.getElementById('current-room');
    this.missionInstructionEl = document.getElementById('mission-instruction');
    this.echoBadge = document.getElementById('echo-badge');

    this.interactPrompt = document.getElementById('interact-prompt');
    this.interactText = document.getElementById('interact-text');
    this.toastBanner = document.getElementById('toast-banner');

    this.rewindOverlay = document.getElementById('rewind-overlay');
    this.rewindLabel = document.getElementById('rewind-label');
    this.dangerVignette = document.getElementById('danger-vignette');

    this.keypadDisplay = document.getElementById('keypad-display');
    this.keypadStatus = document.getElementById('keypad-status');

    this.victoryLoopsEl = document.getElementById('victory-loops');
    this.victoryTimeEl = document.getElementById('victory-time');
    this.gameoverReasonEl = document.getElementById('gameover-reason');
    this.gameoverLoopsEl = document.getElementById('gameover-loops');
    this.gameoverTimeEl = document.getElementById('gameover-time');

    this.launchHud = document.getElementById('launch-hud');
    this.launchStageEl = document.getElementById('launch-stage');
    this.launchAltEl = document.getElementById('launch-alt');
    this.launchVelEl = document.getElementById('launch-vel');

    this.minimap = new MinimapRenderer(document.getElementById('minimap-canvas'), 166, 166, true);
    this.fullmap = new MinimapRenderer(document.getElementById('fullmap-canvas'), 420, 520, false);
    this.toastTimeout = null;
  }

  setScreens(phase, keypadOpen = false, mapOpen = false) {
    this.startScreen.classList.toggle('hidden', phase !== 'start');
    this.briefingModal.classList.toggle('hidden', phase !== 'briefing');
    this.pauseScreen.classList.toggle('hidden', phase !== 'paused');
    this.victoryScreen.classList.toggle('hidden', phase !== 'victory');
    if (this.gameoverScreen) {
      this.gameoverScreen.classList.toggle('hidden', phase !== 'gameover');
    }
    this.keypadModal.classList.toggle('hidden', !keypadOpen || phase !== 'playing');
    this.mapModal.classList.toggle('hidden', !mapOpen || phase !== 'playing');
    const showHud =
      phase === 'playing' ||
      phase === 'briefing' ||
      phase === 'rewinding' ||
      phase === 'paused';
    this.hud.classList.toggle('hidden', !showHud);
    if (this.launchHud) {
      this.launchHud.classList.toggle('hidden', phase !== 'launching');
    }
  }

  updateLaunchTelemetry(stageText, altitudeKm, velocityKmS) {
    if (!this.launchHud) return;
    this.launchStageEl.textContent = stageText;
    this.launchAltEl.textContent = `${altitudeKm.toFixed(1)} km`;
    this.launchVelEl.textContent = `${velocityKmS.toFixed(2)} km/s`;
  }

  _updateMemItem(el, done, doneText = 'SAVED', pendingText = 'PENDING') {
    if (!el) return;
    el.classList.toggle('done', done);
    el.classList.toggle('locked', !done);
    const icon = el.querySelector('.mem-icon');
    const status = el.querySelector('.mem-status');
    if (icon) icon.textContent = done ? '✔' : '◎';
    if (status) status.textContent = done ? doneText : pendingText;
  }

  _updateGearSlot(el, equipped, label, emptyLabel = 'EMPTY') {
    if (!el) return;
    el.classList.toggle('equipped', equipped);
    el.classList.toggle('empty', !equipped);
    const st = el.querySelector('.gear-state');
    if (st) st.textContent = equipped ? label : emptyLabel;
  }

  updateKeypadDisplay(inputDigits, errorMsg = null) {
    const padded = inputDigits.padEnd(4, '_').split('').join(' ');
    this.keypadDisplay.textContent = padded;
    if (errorMsg) {
      this.keypadStatus.textContent = errorMsg;
      this.keypadStatus.classList.add('error');
      this.keypadDisplay.classList.remove('shake');
      void this.keypadDisplay.offsetWidth;
      this.keypadDisplay.classList.add('shake');
    } else {
      this.keypadStatus.textContent = 'Type on keyboard (0–9) or click keypad below';
      this.keypadStatus.classList.remove('error');
      this.keypadDisplay.classList.remove('shake');
    }
  }

  update(
    state,
    roomName,
    promptText,
    playerPos,
    facingAngle,
    mines,
    safePoints,
    echoTrail = [],
    echoAlpha = 0
  ) {
    this.loopCountEl.textContent = `${state.loopCount}/${MAX_LOOPS}`;
    this.loopCountEl.classList.toggle('warn-loop', state.loopCount === 2);
    this.loopCountEl.classList.toggle('final-loop', state.loopCount >= MAX_LOOPS);
    this.timerValueEl.textContent = state.loopTimer.toFixed(1);
    this.totalTimeEl.textContent = formatTime(state.totalTimeSpent);

    const pct = Math.max(0, Math.min(100, (state.loopTimer / LOOP_DURATION) * 100));
    this.timerBarFill.style.width = `${pct}%`;

    const isWarning = state.loopTimer <= 10 && state.loopTimer > 5;
    const isCritical = state.loopTimer <= 5;
    this.timerBox.classList.toggle('warning', isWarning);
    this.timerBox.classList.toggle('critical', isCritical);
    this.dangerVignette.classList.toggle('hidden', !isCritical || state.phase !== 'playing');

    const m = state.memory;
    this._updateMemItem(this.memTelemetry, m.telemetryScanned, 'MAPPED', 'PENDING');
    this._updateMemItem(this.memCode, m.securityCodeFound, state.securityCodeValue, 'PENDING');
    this._updateMemItem(this.memKeycard, m.keycardObtained, 'IN HAND', 'PENDING');
    this._updateMemItem(this.memBlastdoor, m.blastDoorUnlocked, 'OPEN', 'LOCKED');

    const telSector = getSectorByRole(state.sectorAssignments, 'telemetry');
    const secSector = getSectorByRole(state.sectorAssignments, 'security');
    const keySector = getSectorByRole(state.sectorAssignments, 'keycard');

    this.memTelemetryDesc.textContent = state.discoveredSectors[telSector]
      ? `Sector ${telSector} — Research Lab`
      : 'Explore Sectors A–H';
    this.memCodeDesc.textContent = m.securityCodeFound
      ? `Sector ${secSector} — Code: ${state.securityCodeValue}`
      : state.discoveredSectors[secSector]
      ? `Sector ${secSector} — Security Core`
      : 'Behind Laser Gate';
    this.memKeycardDesc.textContent = state.discoveredSectors[keySector]
      ? `Sector ${keySector} — Medical Bay`
      : 'Explore Sectors A–H';

    this.codeChip.classList.toggle('hidden', !m.securityCodeFound);
    if (m.securityCodeFound) {
      this.hudCodeValue.textContent = state.securityCodeValue;
    }

    this._updateGearSlot(this.gearScanner, m.telemetryScanned, 'L ✔', 'L');
    this._updateGearSlot(
      this.gearCipher,
      m.securityCodeFound,
      m.securityCodeFound ? state.securityCodeValue : 'W',
      'W'
    );
    this._updateGearSlot(this.gearKeycard, m.keycardObtained, 'R ✔', 'R');

    this.currentRoomEl.textContent = roomName;
    this.missionInstructionEl.textContent = getCurrentMissionHint(state);

    if (this.echoBadge) {
      this.echoBadge.classList.toggle('hidden', echoAlpha <= 0.02);
    }

    if (promptText && state.phase === 'playing' && !state.keypadOpen && !state.mapOpen) {
      this.interactText.textContent = promptText;
      this.interactPrompt.classList.remove('hidden');
    } else {
      this.interactPrompt.classList.add('hidden');
    }

    this.minimap.draw(state, playerPos, facingAngle, mines, safePoints, echoTrail, echoAlpha);
    if (state.mapOpen && state.phase === 'playing') {
      this.fullmap.draw(state, playerPos, facingAngle, mines, safePoints, echoTrail, echoAlpha);
    }
  }

  showToast(message, isDanger = false, durationMs = 2600) {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.toastBanner.textContent = message;
    this.toastBanner.classList.toggle('danger', isDanger);
    this.toastBanner.classList.remove('hidden');
    this.toastTimeout = setTimeout(() => {
      this.toastBanner.classList.add('hidden');
    }, durationMs);
  }

  triggerRewindEffect(reason = 'TEMPORAL REWIND INITIATED', isHazard = false) {
    this.rewindLabel.textContent = reason;
    this.rewindOverlay.classList.toggle('hazard-fx', isHazard);
    this.rewindOverlay.classList.remove('hidden');
    this.rewindOverlay.style.animation = 'none';
    void this.rewindOverlay.offsetWidth;
    this.rewindOverlay.style.animation = '';
    setTimeout(() => {
      this.rewindOverlay.classList.add('hidden');
    }, 650);
  }

  showVictory(state) {
    this.victoryLoopsEl.textContent = `${state.loopCount} / ${MAX_LOOPS}`;
    this.victoryTimeEl.textContent = formatTime(state.totalTimeSpent);
    this.setScreens('victory', false);
  }

  showGameOver(state, reason) {
    if (this.gameoverReasonEl) this.gameoverReasonEl.textContent = reason;
    if (this.gameoverLoopsEl) this.gameoverLoopsEl.textContent = `${state.loopCount} / ${MAX_LOOPS}`;
    if (this.gameoverTimeEl) this.gameoverTimeEl.textContent = formatTime(state.totalTimeSpent);
    this.setScreens('gameover', false);
  }
}
