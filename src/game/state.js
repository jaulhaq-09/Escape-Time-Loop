export const LOOP_DURATION = 30.0;
export const MAX_LOOPS = 3;

export const SECTOR_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export function generateSecurityCode() {
  const digits = [];
  for (let i = 0; i < 4; i++) {
    digits.push(Math.floor(1 + Math.random() * 9));
  }
  return digits.join('');
}

function shuffled(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createSectorAssignments() {
  const order = shuffled(SECTOR_IDS);
  return {
    [order[0]]: 'telemetry',
    [order[1]]: 'security',
    [order[2]]: 'keycard',
    [order[3]]: 'booster',
    [order[4]]: 'decoy1',
    [order[5]]: 'decoy2',
    [order[6]]: 'decoy3',
    [order[7]]: 'decoy4',
  };
}

export function getSectorByRole(assignments, role) {
  for (const [sectorId, assignedRole] of Object.entries(assignments)) {
    if (assignedRole === role) return sectorId;
  }
  return 'A';
}

export function createInitialGameState() {
  const sectorAssignments = createSectorAssignments();
  const reactorRouteIndex = Math.floor(Math.random() * 3);

  return {
    phase: 'start', // 'start' | 'briefing' | 'playing' | 'paused' | 'rewinding' | 'launching' | 'victory' | 'gameover'
    failReason: '',
    keypadOpen: false,
    mapOpen: false,
    loopCount: 1,
    loopTimer: LOOP_DURATION,
    totalTimeSpent: 0,
    lastCountdownBeep: -1,
    lastHeartbeatBeat: 0,
    securityCodeValue: generateSecurityCode(),
    sectorAssignments,
    reactorRouteIndex,
    stabilizerCollectedThisLoop: false,
    boosterUsedThisLoop: false,

    // Persistent memory across all loops
    memory: {
      telemetryScanned: false,
      securityCodeFound: false,
      keycardObtained: false,
      blastDoorUnlocked: false,
    },

    // Persistent sector intel discovered by exploring
    discoveredSectors: {
      A: null,
      B: null,
      C: null,
      D: null,
      E: null,
      F: null,
      G: null,
      H: null,
    },
  };
}

export function allObjectivesComplete(state) {
  const m = state.memory;
  return (
    m.telemetryScanned &&
    m.securityCodeFound &&
    m.keycardObtained &&
    m.blastDoorUnlocked
  );
}

export function getCurrentMissionHint(state) {
  const m = state.memory;
  if (!m.telemetryScanned && !m.keycardObtained && !m.securityCodeFound) {
    return 'Explore Sectors A–H to find Research Lab, Security Core & Medical Bay. Beware 4 decoys!';
  }
  if (!m.telemetryScanned) {
    return 'Locate the Research Lab among Sectors A–H to scan Reactor Telemetry.';
  }
  if (!m.securityCodeFound) {
    return 'Time the Laser Gate into the Security Core to extract the 4-digit Override Code.';
  }
  if (!m.keycardObtained) {
    return 'Locate the Medical Bay to equip the Quantum Keycard in your right hand.';
  }
  if (!m.blastDoorUnlocked) {
    return `Enter code ${state.securityCodeValue} manually at the North Blast Door Keypad.`;
  }
  return 'All 4 systems ready! Cross the Reactor Safe Route (North) to Escape Pod [E]!';
}
