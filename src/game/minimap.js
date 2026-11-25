import { getSectorByRole } from './state.js';

export const SECTOR_BOUNDS = {
  A: { x: -18, z: 1.5, w: 12, d: 7.0, labelX: -12, labelZ: 5.0, doorZ: 5.5 },
  B: { x: -18, z: -6.5, w: 12, d: 7.0, labelX: -12, labelZ: -3.0, doorZ: -2.5 },
  F: { x: -18, z: -14.5, w: 12, d: 7.0, labelX: -12, labelZ: -11.0, doorZ: -10.5 },
  G: { x: -18, z: 10.0, w: 12, d: 8.0, labelX: -12, labelZ: 14.0, doorZ: 14.0 },
  C: { x: 6, z: 1.5, w: 12, d: 7.0, labelX: 12, labelZ: 5.0, doorZ: 5.5 },
  D: { x: 6, z: -6.5, w: 12, d: 7.0, labelX: 12, labelZ: -3.0, doorZ: -2.5 },
  H: { x: 6, z: -14.5, w: 12, d: 7.0, labelX: 12, labelZ: -11.0, doorZ: -10.5 },
  E: { x: 6, z: 10.0, w: 12, d: 8.0, labelX: 12, labelZ: 14.0, doorZ: 14.0 },
};

const ROLE_TAGS = {
  telemetry: { tag: 'LAB', color: '#00f0ff', bg: 'rgba(0, 125, 165, 0.5)' },
  security: { tag: 'SEC', color: '#d8b4fe', bg: 'rgba(115, 45, 175, 0.5)' },
  keycard: { tag: 'KEY', color: '#00ff9d', bg: 'rgba(0, 135, 92, 0.5)' },
  booster: { tag: '+8s', color: '#38bdf8', bg: 'rgba(14, 116, 144, 0.45)' },
  decoy1: { tag: 'DECOY', color: '#ff6b81', bg: 'rgba(130, 30, 45, 0.45)' },
  decoy2: { tag: 'DECOY', color: '#ff6b81', bg: 'rgba(130, 30, 45, 0.45)' },
  decoy3: { tag: 'DECOY', color: '#ff6b81', bg: 'rgba(130, 30, 45, 0.45)' },
  decoy4: { tag: 'DECOY', color: '#ff6b81', bg: 'rgba(130, 30, 45, 0.45)' },
};

export class MinimapRenderer {
  constructor(canvas, cssWidth = 176, cssHeight = 176, circular = true) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.circular = circular;

    if (this.canvas && this.ctx) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = this.cssWidth * dpr;
      this.canvas.height = this.cssHeight * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  _toPx(wx, wz) {
    // World X: [-21, 21] (span 42); World Z: [-43, 21] (span 64)
    const padX = this.circular ? 14 : 12;
    const padY = this.circular ? 14 : 12;
    const usableW = this.cssWidth - padX * 2;
    const usableH = this.cssHeight - padY * 2;
    const x = padX + ((wx + 21) / 42) * usableW;
    const y = padY + ((wz + 43) / 64) * usableH;
    return [x, y];
  }

  _rect(wx, wz, ww, wd, fill, stroke = null, lineWidth = 1.4) {
    const ctx = this.ctx;
    const [x1, y1] = this._toPx(wx, wz);
    const [x2, y2] = this._toPx(wx + ww, wz + wd);
    ctx.fillStyle = fill;
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }
  }

  _drawDoorGap(wx, wz, ww, wd, color = '#1c365c') {
    const ctx = this.ctx;
    const [x1, y1] = this._toPx(wx, wz);
    const [x2, y2] = this._toPx(wx + ww, wz + wd);
    ctx.fillStyle = color;
    ctx.fillRect(x1, y1, Math.max(3, x2 - x1), Math.max(3, y2 - y1));
  }

  _isInside(pos, wx, wz, ww, wd) {
    return pos.x >= wx && pos.x <= wx + ww && pos.z >= wz && pos.z <= wz + wd;
  }

  _drawBadge(px, py, letter, bg, fg, radius) {
    const ctx = this.ctx;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.fillStyle = fg;
    ctx.font = `bold ${Math.max(8, Math.round(radius * 1.25))}px Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, px, py + 0.5);
  }

  draw(state, playerPos, facingAngle, mines, safePoints, echoTrail = [], echoAlpha = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.cssWidth;
    const h = this.cssHeight;
    const scale = w / 260;

    ctx.clearRect(0, 0, w, h);
    ctx.save();

    if (this.circular) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - 2, 0, Math.PI * 2);
      ctx.clip();
    }

    // Radar background + concentric rings & crosshairs
    ctx.fillStyle = '#050d1e';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.lineWidth = 1;
    for (const rFrac of [0.24, 0.48, 0.72, 0.94]) {
      ctx.beginPath();
      ctx.arc(cx, cy, (Math.min(w, h) / 2) * rFrac, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();

    // 1. Main Spine Rooms (always visible on radar!)
    const inCryo = this._isInside(playerPos, -6, 9.5, 12, 9);
    const inHub = this._isInside(playerPos, -6, -15.5, 12, 25);
    const inReactor = this._isInside(playerPos, -6, -31.5, 12, 16);
    const inPod = this._isInside(playerPos, -6, -41.5, 12, 10);

    this._rect(-6, 9.5, 12, 9, inCryo ? 'rgba(0, 150, 210, 0.36)' : '#11223d', '#38bdf8', 1.4);
    this._rect(-6, -15.5, 12, 25, inHub ? 'rgba(0, 150, 210, 0.30)' : '#162845', '#38bdf8', 1.4);
    this._rect(-6, -31.5, 12, 16, inReactor ? 'rgba(220, 80, 30, 0.36)' : '#2e161f', '#fb923c', 1.4);
    this._rect(-6, -41.5, 12, 10, inPod ? 'rgba(0, 180, 120, 0.36)' : '#103236', '#34d399', 1.4);

    // 2. All 8 Wing Sectors (clearly visible!)
    for (const [sectorId, b] of Object.entries(SECTOR_BOUNDS)) {
      const discovered = state.discoveredSectors[sectorId];
      const inside = this._isInside(playerPos, b.x, b.z, b.w, b.d);
      let fill = inside ? 'rgba(0, 140, 190, 0.36)' : '#122038';
      let stroke = inside ? '#00f0ff' : '#64748b';
      if (discovered) {
        const info = ROLE_TAGS[discovered];
        fill = info.bg;
        stroke = info.color;
      }
      this._rect(b.x, b.z, b.w, b.d, fill, stroke, inside ? 2.0 : 1.3);
    }

    // 3. Open Doorway Gaps
    this._drawDoorGap(-2.5, 9.1, 5.0, 0.8); // Cryo <-> Hub
    for (const b of Object.values(SECTOR_BOUNDS)) {
      const doorX = b.x < 0 ? -6.4 : 5.6;
      this._drawDoorGap(doorX, b.doorZ - 2.0, 0.8, 4.0);
    }
    this._drawDoorGap(-2.8, -31.9, 5.6, 0.8, '#173832'); // Reactor <-> Pod

    // 4. Sector Labels
    const isLarge = w >= 340;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const [sectorId, b] of Object.entries(SECTOR_BOUNDS)) {
      const discovered = state.discoveredSectors[sectorId];
      const [lx, ly] = this._toPx(b.labelX, b.labelZ);
      const fontPx = Math.max(6.5, Math.round((isLarge ? 10 : 8.5) * scale));
      ctx.font = `bold ${fontPx}px Consolas, monospace`;
      if (discovered) {
        const info = ROLE_TAGS[discovered];
        ctx.fillStyle = info.color;
        ctx.fillText(isLarge ? `${sectorId}:${info.tag}` : info.tag, lx, ly);
      } else {
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(sectorId, lx, ly);
      }
    }

    if (isLarge) {
      ctx.font = 'bold 10px Consolas, monospace';
      const [hx, hy] = this._toPx(0, -3.0);
      ctx.fillStyle = '#93c5fd';
      ctx.fillText('CENTRAL HUB', hx, hy);
      const [rx, ry] = this._toPx(0, -23.5);
      ctx.fillStyle = '#fdba74';
      ctx.fillText('REACTOR', rx, ry);
    }

    // 5. Security Laser Doorway Indicator
    const secSector = getSectorByRole(state.sectorAssignments, 'security');
    const secB = SECTOR_BOUNDS[secSector];
    const laserX = secB.x < 0 ? -6 : 6;
    const [slx, sly] = this._toPx(laserX, secB.doorZ);
    ctx.strokeStyle = '#ff3b5c';
    ctx.lineWidth = Math.max(2.5, 3.2 * scale);
    ctx.beginPath();
    ctx.moveTo(slx, sly - 6 * scale);
    ctx.lineTo(slx, sly + 6 * scale);
    ctx.stroke();

    // 6. Blast Door (Z = -15.5)
    const [bdx1, bdy] = this._toPx(-2.8, -15.5);
    const [bdx2] = this._toPx(2.8, -15.5);
    ctx.strokeStyle = state.memory.blastDoorUnlocked ? '#00ff9d' : '#ffaa00';
    ctx.lineWidth = Math.max(2.5, 3.5 * scale);
    ctx.beginPath();
    ctx.moveTo(bdx1, bdy);
    ctx.lineTo(bdx2, bdy);
    ctx.stroke();

    // 7. Temporal Stabilizer (+5s) orb
    if (!state.stabilizerCollectedThisLoop) {
      const [sx, sy] = this._toPx(4.5, -14.0);
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(2.4, 3.5 * scale), 0, Math.PI * 2);
      ctx.fill();
    }

    // 8. Reactor Safe Route & Mines (once Telemetry Scanned)
    if (state.memory.telemetryScanned) {
      ctx.strokeStyle = '#00ff9d';
      ctx.lineWidth = Math.max(1.5, 2.2 * scale);
      ctx.beginPath();
      safePoints.forEach(([rx, rz], idx) => {
        const [px, py] = this._toPx(rx, rz);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      ctx.fillStyle = '#ff3b5c';
      for (const m of mines) {
        const [mx, my] = this._toPx(m.x, m.z);
        ctx.beginPath();
        ctx.arc(mx, my, Math.max(1.8, 2.6 * scale), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 9. Previous Loop Echo Trail
    if (echoTrail.length >= 2 && echoAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = echoAlpha;
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = Math.max(1.6, 2.2 * scale);
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      echoTrail.forEach(([ex, ez], idx) => {
        const [px, py] = this._toPx(ex, ez);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 10. Bold 'S' (Start: Cryo-Pod Bay) and 'E' (End: Escape Pod Bay) Symbols!
    const [startX, startY] = this._toPx(0, 16.5);
    this._drawBadge(startX, startY, 'S', '#0ea5e9', '#ffffff', Math.max(6.2, 7.5 * scale));

    const podReady =
      state.memory.telemetryScanned &&
      state.memory.securityCodeFound &&
      state.memory.keycardObtained &&
      state.memory.blastDoorUnlocked;
    const [endX, endY] = this._toPx(0, -37.5);
    this._drawBadge(
      endX,
      endY,
      'E',
      podReady ? '#00ff9d' : '#f59e0b',
      '#04101f',
      Math.max(6.8, 8.2 * scale)
    );

    // 11. Exact Live Player Position & Facing Arrow
    const [px, py] = this._toPx(playerPos.x, playerPos.z);
    const dx = Math.sin(facingAngle);
    const dy = Math.cos(facingAngle);
    const angle = Math.atan2(dy, dx);
    const pScale = Math.max(0.75, scale);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);

    ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, 8 * pScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#00f0ff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(7 * pScale, 0);
    ctx.lineTo(-4.5 * pScale, -4.5 * pScale);
    ctx.lineTo(-2.5 * pScale, 0);
    ctx.lineTo(-4.5 * pScale, 4.5 * pScale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();

    // Outer circular glow rim
    if (this.circular) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.72)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
