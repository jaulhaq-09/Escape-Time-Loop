import * as THREE from 'three';
import { SECTOR_BOUNDS } from './minimap.js';

function createSignTexture(title, subtitle, color = '#00f0ff') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#071124';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

  ctx.fillStyle = color;
  ctx.font = 'bold 44px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, canvas.width / 2, 60);

  if (subtitle) {
    ctx.fillStyle = '#cbe5ff';
    ctx.font = 'bold 23px Consolas, monospace';
    ctx.fillText(subtitle, canvas.width / 2, 118);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDeckGridTexture(baseHex, gridHex, repeatX, repeatZ) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  // Subtle brushed metal sub-panels
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, size - 4, size - 4);
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();

  // Accent micro-grid & corner rivets
  ctx.strokeStyle = gridHex;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = gridHex;
  for (const [rx, ry] of [
    [14, 14],
    [size - 14, 14],
    [14, size - 14],
    [size - 14, size - 14],
  ]) {
    ctx.beginPath();
    ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatZ);
  return tex;
}

const UNIFORM_ROOM_HEX = 0x38bdf8;
const UNIFORM_ROOM_CSS = '#38bdf8';

const ROLE_VISUALS = {
  telemetry: {
    title: 'RESEARCH LAB',
    subtitle: 'TELEMETRY TERMINAL',
    color: UNIFORM_ROOM_CSS,
    hex: UNIFORM_ROOM_HEX,
  },
  security: {
    title: 'SECURITY CORE',
    subtitle: 'CIPHER TERMINAL',
    color: UNIFORM_ROOM_CSS,
    hex: UNIFORM_ROOM_HEX,
  },
  keycard: {
    title: 'MEDICAL BAY',
    subtitle: 'QUANTUM VAULT',
    color: UNIFORM_ROOM_CSS,
    hex: UNIFORM_ROOM_HEX,
  },
  booster: {
    title: 'TEMPORAL RELAY',
    subtitle: 'STABILIZER NODE',
    color: UNIFORM_ROOM_CSS,
    hex: UNIFORM_ROOM_HEX,
  },
  decoy1: {
    title: 'ARCHIVE WING',
    subtitle: 'DATA TERMINAL',
    color: UNIFORM_ROOM_CSS,
    hex: UNIFORM_ROOM_HEX,
  },
  decoy2: {
    title: 'CARGO SECTOR',
    subtitle: 'LOGISTICS TERMINAL',
    color: UNIFORM_ROOM_CSS,
    hex: UNIFORM_ROOM_HEX,
  },
  decoy3: {
    title: 'AIRLOCK CONTROL',
    subtitle: 'SYSTEM CONSOLE',
    color: UNIFORM_ROOM_CSS,
    hex: UNIFORM_ROOM_HEX,
  },
  decoy4: {
    title: 'COOLANT BAY',
    subtitle: 'REACTOR MONITOR',
    color: UNIFORM_ROOM_CSS,
    hex: UNIFORM_ROOM_HEX,
  },
};

export class StationLevel {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.interactables = [];
    this.dynamicGroup = new THREE.Group();
    this.scene.add(this.dynamicGroup);

    this.blastDoorCollider = null;
    this.blastDoorMesh = null;
    this.blastDoorOpenAmount = 0;

    this.escapePodGroup = null;
    this.escapePodBeaconMat = null;
    this.escapePodLight = null;
    this.escapePodFlame = null;
    this.escapePodOuterFlame = null;
    this.escapePodShockCone = null;
    this.rocketCanopy = null;
    this.pilotSeatAnchor = null;
    this.leftBoosterGroup = null;
    this.rightBoosterGroup = null;
    this.leftBoosterFlame = null;
    this.rightBoosterFlame = null;
    this.gantryArmLeft = null;
    this.gantryArmRight = null;

    this.earthGroup = null;
    this.earthBody = null;
    this.earthClouds = null;

    this.stabilizerMesh = null;
    this.stabilizerPos = new THREE.Vector3(4.5, 0, -14.0);

    this.starfield = null;
    this.heroStars = null;
    this.spacePlanet = null;
    this.planetBody = null;
    this.echoGroup = new THREE.Group();
    this.echoMaterials = [];
    this.scene.add(this.echoGroup);

    this.reactorRings = [];
    this.holoSpinners = [];
    this.keycardMesh = null;
    this.telemetryScreenMat = null;
    this.securityScreenMat = null;
    this.boosterScreenMat = null;
    this.blastTerminalMat = null;

    this._buildStarfield();
    this._buildFloors();
    this._buildWalls();
    this._buildTrussesAndFloorGuides();
    this._buildStaticPropsAndLights();
    this._buildStaticInteractables();
    this._buildStaticSigns();
  }

  _createStarGlowTexture(withFlare = false) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size / 2;

    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.14, 'rgba(255, 255, 255, 0.92)');
    grad.addColorStop(0.32, 'rgba(200, 230, 255, 0.42)');
    grad.addColorStop(0.65, 'rgba(130, 180, 255, 0.08)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    if (withFlare) {
      ctx.save();
      ctx.translate(c, c);
      for (let i = 0; i < 2; i++) {
        const flareGrad = ctx.createLinearGradient(-c, 0, c, 0);
        flareGrad.addColorStop(0, 'rgba(255,255,255,0)');
        flareGrad.addColorStop(0.5, 'rgba(255,255,255,0.85)');
        flareGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = flareGrad;
        ctx.fillRect(-c, -1.6, size, 3.2);
        ctx.rotate(Math.PI / 2);
      }
      ctx.restore();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createNebulaTexture(innerColor, outerColor) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size / 2;

    const grad = ctx.createRadialGradient(c, c, 4, c, c, c);
    grad.addColorStop(0.0, innerColor);
    grad.addColorStop(0.45, outerColor);
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createPlanetTexture() {
    const w = 512;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const base = ctx.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0.0, '#12182f');
    base.addColorStop(0.18, '#283663');
    base.addColorStop(0.35, '#4b3b7d');
    base.addColorStop(0.48, '#8162a6');
    base.addColorStop(0.55, '#c29b82');
    base.addColorStop(0.65, '#59428a');
    base.addColorStop(0.82, '#24325c');
    base.addColorStop(1.0, '#0f1426');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 42; i++) {
      const y = (i / 42) * h + (Math.random() - 0.5) * 4;
      const bandH = 1.5 + Math.random() * 6;
      const alpha = 0.06 + Math.random() * 0.14;
      ctx.fillStyle =
        i % 3 === 0
          ? `rgba(224, 212, 255, ${alpha})`
          : i % 3 === 1
          ? `rgba(110, 175, 235, ${alpha})`
          : `rgba(245, 196, 150, ${alpha * 0.85})`;
      ctx.fillRect(0, y, w, bandH);
    }

    const storm = ctx.createRadialGradient(w * 0.62, h * 0.58, 2, w * 0.62, h * 0.58, 28);
    storm.addColorStop(0, 'rgba(255, 210, 175, 0.55)');
    storm.addColorStop(0.5, 'rgba(180, 120, 165, 0.25)');
    storm.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = storm;
    ctx.beginPath();
    ctx.ellipse(w * 0.62, h * 0.58, 30, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }

  _createPlanetRingTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size / 2;

    const grad = ctx.createRadialGradient(c, c, size * 0.23, c, c, size * 0.49);
    grad.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.08, 'rgba(155, 185, 225, 0.22)');
    grad.addColorStop(0.24, 'rgba(215, 225, 245, 0.55)');
    grad.addColorStop(0.42, 'rgba(180, 195, 230, 0.48)');
    grad.addColorStop(0.48, 'rgba(30, 40, 65, 0.08)');
    grad.addColorStop(0.55, 'rgba(205, 220, 245, 0.5)');
    grad.addColorStop(0.78, 'rgba(140, 175, 215, 0.28)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    for (let r = size * 0.26; r < size * 0.48; r += 3.5) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.03 + Math.random() * 0.08})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildStarfield() {
    const roundStarTex = this._createStarGlowTexture(false);
    const flareStarTex = this._createStarGlowTexture(true);

    const createStarLayer = (count, size, opacity, tex, palette) => {
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        let sx = (Math.random() - 0.5) * 195;
        let sy = -2.5 - Math.random() * 34;
        let sz = -14 + (Math.random() - 0.5) * 185;

        if (Math.abs(sx) < 20 && sz > -44 && sz < 22 && sy > -6) {
          sy -= 15;
        }

        positions[i * 3] = sx;
        positions[i * 3 + 1] = sy;
        positions[i * 3 + 2] = sz;

        const base = palette[i % palette.length];
        const brightness = 0.65 + Math.random() * 0.35;
        colors[i * 3] = base.r * brightness;
        colors[i * 3 + 1] = base.g * brightness;
        colors[i * 3 + 2] = base.b * brightness;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.PointsMaterial({
        size,
        map: tex,
        vertexColors: true,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      });
      const pts = new THREE.Points(geo, mat);
      this.scene.add(pts);
      return pts;
    };

    const naturalPalette = [
      new THREE.Color(0xffffff),
      new THREE.Color(0xdbeafe),
      new THREE.Color(0xbfdbfe),
      new THREE.Color(0xfef3c7),
      new THREE.Color(0xfde68a),
      new THREE.Color(0xe9d5ff),
    ];

    this.starfield = createStarLayer(2600, 0.42, 0.9, roundStarTex, naturalPalette);
    createStarLayer(460, 0.85, 0.85, roundStarTex, naturalPalette);
    this.heroStars = createStarLayer(85, 1.85, 0.92, flareStarTex, naturalPalette);

    const nebulaConfigs = [
      ['rgba(56, 189, 248, 0.14)', 'rgba(14, 116, 144, 0.04)', -28, -22, -8, 46],
      ['rgba(168, 85, 247, 0.14)', 'rgba(88, 28, 135, 0.04)', 26, -24, -18, 52],
      ['rgba(59, 130, 246, 0.12)', 'rgba(30, 58, 138, 0.03)', -18, -26, 18, 44],
      ['rgba(16, 185, 129, 0.10)', 'rgba(6, 78, 59, 0.03)', 22, -25, 14, 42],
    ];
    for (const [inner, outer, nx, ny, nz, scale] of nebulaConfigs) {
      const mat = new THREE.SpriteMaterial({
        map: this._createNebulaTexture(inner, outer),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(nx, ny, nz);
      sprite.scale.set(scale, scale, 1);
      this.scene.add(sprite);
    }

    // Ringed Gas-Giant Exoplanet
    const planetGroup = new THREE.Group();
    planetGroup.position.set(-31, -13, -20);

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(5.6, 40, 28),
      new THREE.MeshStandardMaterial({
        map: this._createPlanetTexture(),
        roughness: 0.78,
        metalness: 0.05,
        fog: false,
      })
    );
    sphere.rotation.z = 0.22;

    const glowRim = new THREE.Mesh(
      new THREE.SphereGeometry(5.95, 32, 24),
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.24,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );

    const ring = new THREE.Mesh(
      new THREE.PlaneGeometry(25, 25),
      new THREE.MeshStandardMaterial({
        map: this._createPlanetRingTexture(),
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.6,
        depthWrite: false,
        fog: false,
      })
    );
    ring.rotation.x = -Math.PI / 2.35;
    ring.rotation.y = 0.28;

    const planetSun = new THREE.PointLight(0xfff1dc, 2.4, 24, 1);
    planetSun.position.set(9, 6, 7);

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 20, 16),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9, fog: false })
    );
    moon.position.set(9.8, 1.4, 4.5);

    planetGroup.add(sphere, glowRim, ring, planetSun, moon);
    this.scene.add(planetGroup);
    this.spacePlanet = planetGroup;
    this.planetBody = sphere;

    this._buildRealisticEarth();
  }

  _noise3(x, y, z) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const xf = x - xi;
    const yf = y - yi;
    const zf = z - zi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const w = zf * zf * (3 - 2 * zf);

    const hash = (ix, iy, iz) => {
      const h = Math.sin(ix * 127.1 + iy * 311.7 + iz * 74.7) * 43758.5453123;
      return h - Math.floor(h);
    };

    const n000 = hash(xi, yi, zi);
    const n100 = hash(xi + 1, yi, zi);
    const n010 = hash(xi, yi + 1, zi);
    const n110 = hash(xi + 1, yi + 1, zi);
    const n001 = hash(xi, yi, zi + 1);
    const n101 = hash(xi + 1, yi, zi + 1);
    const n011 = hash(xi, yi + 1, zi + 1);
    const n111 = hash(xi + 1, yi + 1, zi + 1);

    const nx00 = n000 + (n100 - n000) * u;
    const nx10 = n010 + (n110 - n010) * u;
    const nx01 = n001 + (n101 - n001) * u;
    const nx11 = n011 + (n111 - n011) * u;

    const nxy0 = nx00 + (nx10 - nx00) * v;
    const nxy1 = nx01 + (nx11 - nx01) * v;

    return nxy0 + (nxy1 - nxy0) * w;
  }

  _fbm3(x, y, z, octaves = 4) {
    let val = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < octaves; i++) {
      val += amp * this._noise3(x * freq, y * freq, z * freq);
      freq *= 2.08;
      amp *= 0.5;
    }
    return val;
  }

  _createEarthTextures() {
    const w = 640;
    const h = 320;

    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = w;
    colorCanvas.height = h;
    const cCtx = colorCanvas.getContext('2d');
    const cImg = cCtx.createImageData(w, h);

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = w;
    roughCanvas.height = h;
    const rCtx = roughCanvas.getContext('2d');
    const rImg = rCtx.createImageData(w, h);

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = w;
    bumpCanvas.height = h;
    const bCtx = bumpCanvas.getContext('2d');
    const bImg = bCtx.createImageData(w, h);

    const cityCanvas = document.createElement('canvas');
    cityCanvas.width = w;
    cityCanvas.height = h;
    const eCtx = cityCanvas.getContext('2d');
    const eImg = eCtx.createImageData(w, h);

    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = w;
    cloudCanvas.height = h;
    const clCtx = cloudCanvas.getContext('2d');
    const clImg = clCtx.createImageData(w, h);

    for (let py = 0; py < h; py++) {
      const v = py / (h - 1);
      const phi = v * Math.PI;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const lat = Math.abs(cosPhi);

      for (let px = 0; px < w; px++) {
        const u = px / w;
        const theta = u * Math.PI * 2;
        const nx = sinPhi * Math.cos(theta);
        const ny = cosPhi;
        const nz = sinPhi * Math.sin(theta);

        const elev = this._fbm3(nx * 2.4 + 3.1, ny * 2.4 + 1.7, nz * 2.4 + 5.2, 5);
        const moisture = this._fbm3(nx * 3.8 + 9.4, ny * 3.8 + 2.3, nz * 3.8 + 4.1, 3);
        const seaLevel = 0.515;

        const idx = (py * w + px) * 4;
        let r = 0;
        let g = 0;
        let b = 0;
        let rough = 215;
        let bump = 30;
        let cityR = 0;
        let cityG = 0;
        let cityB = 0;

        // Polar ice caps
        if (lat > 0.87 + (elev - 0.5) * 0.14) {
          r = 235;
          g = 245;
          b = 255;
          rough = 190;
          bump = 110;
        } else if (elev < seaLevel) {
          // Ocean bathymetry gradient + turquoise continental shelf
          const depth = Math.max(0, (seaLevel - elev) / seaLevel);
          const shelf = Math.max(0, 1 - depth * 7.5);
          r = Math.round(7 + shelf * 18);
          g = Math.round(34 + (1 - depth) * 42 + shelf * 68);
          b = Math.round(78 + (1 - depth) * 58 + shelf * 44);
          rough = 72; // Glossy ocean specular glint!
          bump = 16;
        } else {
          // Land biomes (coastal lush green -> plains -> arid desert -> alpine rock -> snow peaks)
          const hNorm = Math.min(1, (elev - seaLevel) / (1 - seaLevel));
          rough = 225;
          bump = Math.round(75 + hNorm * 180);

          if (hNorm > 0.42) {
            // High mountain peaks & snow
            const snow = Math.min(1, (hNorm - 0.42) * 3.2);
            r = Math.round(125 + snow * 115);
            g = Math.round(118 + snow * 124);
            b = Math.round(112 + snow * 135);
          } else if (lat < 0.48 && moisture < 0.46) {
            // Subtropical desert / ochre belt
            r = Math.round(182 - hNorm * 40);
            g = Math.round(154 - hNorm * 35);
            b = Math.round(104 - hNorm * 25);
          } else {
            // Forests & fertile plains
            const lush = Math.max(0, Math.min(1, (moisture - 0.35) * 1.8));
            r = Math.round(36 + (1 - lush) * 48);
            g = Math.round(92 + lush * 42);
            b = Math.round(48 + lush * 14);
          }

          // Night-side city lights cluster on low-elevation coastal/temperate land
          if (hNorm < 0.18 && lat < 0.72) {
            const citySignal = this._noise3(nx * 28, ny * 28, nz * 28);
            if (citySignal > 0.76) {
              const glow = Math.min(1, (citySignal - 0.76) * 4.2);
              cityR = Math.round(255 * glow);
              cityG = Math.round(205 * glow);
              cityB = Math.round(120 * glow);
            }
          }
        }

        cImg.data[idx] = r;
        cImg.data[idx + 1] = g;
        cImg.data[idx + 2] = b;
        cImg.data[idx + 3] = 255;

        rImg.data[idx] = rough;
        rImg.data[idx + 1] = rough;
        rImg.data[idx + 2] = rough;
        rImg.data[idx + 3] = 255;

        bImg.data[idx] = bump;
        bImg.data[idx + 1] = bump;
        bImg.data[idx + 2] = bump;
        bImg.data[idx + 3] = 255;

        eImg.data[idx] = cityR;
        eImg.data[idx + 1] = cityG;
        eImg.data[idx + 2] = cityB;
        eImg.data[idx + 3] = 255;

        // Spherical FBM swirling cloud cover
        const swirl = this._noise3(nx * 2.2, ny * 2.2, nz * 2.2) * 1.4;
        const cVal = this._fbm3(nx * 4.2 + swirl, ny * 5.0, nz * 4.2 - swirl, 4);
        const cloudAlpha = Math.max(0, Math.min(255, Math.round((cVal - 0.49) * 580)));
        clImg.data[idx] = 248;
        clImg.data[idx + 1] = 252;
        clImg.data[idx + 2] = 255;
        clImg.data[idx + 3] = cloudAlpha;
      }
    }

    cCtx.putImageData(cImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
    bCtx.putImageData(bImg, 0, 0);
    eCtx.putImageData(eImg, 0, 0);
    clCtx.putImageData(clImg, 0, 0);

    const wrap = (canvas, srgb = true) => {
      const t = new THREE.CanvasTexture(canvas);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      return t;
    };

    return {
      map: wrap(colorCanvas, true),
      roughnessMap: wrap(roughCanvas, false),
      bumpMap: wrap(bumpCanvas, false),
      emissiveMap: wrap(cityCanvas, true),
      cloudMap: wrap(cloudCanvas, true),
    };
  }

  _buildRealisticEarth() {
    const earthGroup = new THREE.Group();
    // Positioned cleanly off-center in deep orbit so rocket glides gracefully past its horizon!
    earthGroup.position.set(-7, 46, -88);

    const tex = this._createEarthTextures();

    const earthBody = new THREE.Mesh(
      new THREE.SphereGeometry(16.0, 56, 40),
      new THREE.MeshStandardMaterial({
        map: tex.map,
        roughnessMap: tex.roughnessMap,
        roughness: 0.9,
        metalness: 0.06,
        bumpMap: tex.bumpMap,
        bumpScale: 0.28,
        emissive: new THREE.Color(0xffcc77),
        emissiveMap: tex.emissiveMap,
        emissiveIntensity: 0.75,
        fog: false,
      })
    );
    earthBody.rotation.z = 0.26;
    earthBody.rotation.y = 0.8;

    const earthClouds = new THREE.Mesh(
      new THREE.SphereGeometry(16.3, 48, 34),
      new THREE.MeshStandardMaterial({
        map: tex.cloudMap,
        transparent: true,
        opacity: 0.88,
        roughness: 0.92,
        depthWrite: false,
        fog: false,
      })
    );

    // Subtle Rayleigh blue atmosphere rim (BackSide only)
    const atmoHalo = new THREE.Mesh(
      new THREE.SphereGeometry(17.15, 40, 28),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );

    // Bright sunlight creating realistic half-lit Earth crescent & ocean glint
    const earthSun = new THREE.PointLight(0xfff6e5, 3.6, 110, 0.6);
    earthSun.position.set(28, 18, 34);

    earthGroup.add(earthBody, earthClouds, atmoHalo, earthSun);
    this.scene.add(earthGroup);

    this.earthGroup = earthGroup;
    this.earthBody = earthBody;
    this.earthClouds = earthClouds;
  }

  setEchoTrail(points) {
    while (this.echoGroup.children.length > 0) {
      this.echoGroup.remove(this.echoGroup.children[0]);
    }
    this.echoMaterials = [];

    if (!points || points.length < 2) {
      this.echoGroup.visible = false;
      return;
    }

    const linePts = points.map(([x, z]) => new THREE.Vector3(x, 0.14, z));
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.9,
    });
    this.echoMaterials.push(lineMat);
    this.echoGroup.add(new THREE.Line(lineGeo, lineMat));

    const dotGeo = new THREE.RingGeometry(0.14, 0.24, 12);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    this.echoMaterials.push(dotMat);

    for (let i = 0; i < points.length; i += 2) {
      const [px, pz] = points[i];
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(px, 0.12, pz);
      this.echoGroup.add(dot);
    }
    this.echoGroup.visible = true;
  }

  updateEchoTrail(alpha) {
    if (alpha <= 0.01) {
      this.echoGroup.visible = false;
      return;
    }
    this.echoGroup.visible = true;
    for (const mat of this.echoMaterials) {
      mat.opacity = alpha * 0.9;
    }
  }

  _addFloor(x, z, w, d, baseCss, gridCss, accentHex) {
    const tex = createDeckGridTexture(baseCss, gridCss, Math.round(w / 2.4), Math.round(d / 2.4));
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.3, d),
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.55,
        metalness: 0.45,
      })
    );
    floor.position.set(x, -0.15, z);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const trim = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w - 0.18, 0.02, d - 0.18)),
      new THREE.LineBasicMaterial({ color: accentHex, transparent: true, opacity: 0.48 })
    );
    trim.position.set(x, 0.015, z);
    this.scene.add(trim);
  }

  _buildFloors() {
    // Main Spine
    this._addFloor(0, 14.0, 12, 9.0, '#132238', '#00f0ff', 0x00f0ff); // Cryo-Pod Bay
    this._addFloor(0, -3.0, 12, 25.0, '#16253b', '#38bdf8', 0x38bdf8); // Central Corridor
    this._addFloor(0, -23.5, 12, 16.0, '#2a151c', '#ff6622', 0xff5500); // Reactor Area
    this._addFloor(0, -36.5, 12, 10.0, '#0f2b36', '#00ff9d', 0x00ff9d); // Escape Pod Room

    // 8 Wing Sectors
    for (const b of Object.values(SECTOR_BOUNDS)) {
      this._addFloor(
        b.x + b.w / 2,
        b.z + b.d / 2,
        b.w,
        b.d,
        '#142236',
        '#60a5fa',
        0x38bdf8
      );
    }
  }

  _addWall(minX, maxX, minZ, maxZ, height = 3.1, colorHex = 0x1d2b42, trimHex = 0x00d4ff) {
    const w = maxX - minX;
    const d = maxZ - minZ;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;

    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(w, height, d),
      new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.42, metalness: 0.6 })
    );
    wall.position.set(cx, height / 2, cz);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.scene.add(wall);

    // Top neon strip + base plinth trim for clean futuristic depth
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.02, 0.08, d + 0.02),
      new THREE.MeshBasicMaterial({ color: trimHex })
    );
    strip.position.set(cx, height - 0.16, cz);
    this.scene.add(strip);

    const baseTrim = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.06, 0.16, d + 0.06),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.3 })
    );
    baseTrim.position.set(cx, 0.08, cz);
    this.scene.add(baseTrim);

    this.colliders.push({ minX, maxX, minZ, maxZ, disabled: false });
  }

  _addPropBox(targetGroup, minX, maxX, minZ, maxZ, height, colorHex, emissiveHex = 0x000000, registerCollider = true) {
    const w = maxX - minX;
    const d = maxZ - minZ;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, height, d),
      new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: emissiveHex,
        emissiveIntensity: emissiveHex ? 0.55 : 0,
        roughness: 0.38,
        metalness: 0.55,
      })
    );
    mesh.position.set(cx, height / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    targetGroup.add(mesh);

    if (registerCollider) {
      this.colliders.push({ minX, maxX, minZ, maxZ, disabled: false });
    }
    return mesh;
  }

  _buildWalls() {
    // Cryo-Pod Bay (X: -6..6, Z: 9.5..18.5)
    this._addWall(-6.6, 6.6, 18.5, 19.2); // South
    // West Cryo wall with doorway to Sector G (Z: 12.0..16.0)
    this._addWall(-6.4, -5.6, 9.5, 12.0);
    this._addWall(-6.4, -5.6, 16.0, 19.2);
    // East Cryo wall with doorway to Sector E (Z: 12.0..16.0)
    this._addWall(5.6, 6.4, 9.5, 12.0);
    this._addWall(5.6, 6.4, 16.0, 19.2);
    // North Cryo wall with doorway to Central Corridor (X: -2.5..2.5)
    this._addWall(-6.4, -2.5, 9.1, 9.9);
    this._addWall(2.5, 6.4, 9.1, 9.9);

    // Central Corridor West Wall (Z: -15.5..9.5)
    // Doorways: A (3.5..7.5), B (-4.5..-0.5), F (-12.5..-8.5)
    this._addWall(-6.4, -5.6, 7.5, 9.5);
    this._addWall(-6.4, -5.6, -0.5, 3.5);
    this._addWall(-6.4, -5.6, -8.5, -4.5);
    this._addWall(-6.4, -5.6, -15.5, -12.5);

    // Central Corridor East Wall (Z: -15.5..9.5)
    // Doorways: C (3.5..7.5), D (-4.5..-0.5), H (-12.5..-8.5)
    this._addWall(5.6, 6.4, 7.5, 9.5);
    this._addWall(5.6, 6.4, -0.5, 3.5);
    this._addWall(5.6, 6.4, -8.5, -4.5);
    this._addWall(5.6, 6.4, -15.5, -12.5);

    // Blast Door Wall at Z = -15.5
    this._addWall(-6.4, -2.8, -15.9, -15.1, 3.2, 0x2d3748, 0xffaa00);
    this._addWall(2.8, 6.4, -15.9, -15.1, 3.2, 0x2d3748, 0xffaa00);

    // Armored Blast Door
    this.blastDoorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 3.0, 0.5),
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        emissive: 0x661122,
        emissiveIntensity: 0.45,
        metalness: 0.75,
        roughness: 0.3,
      })
    );
    this.blastDoorMesh.position.set(0, 1.5, -15.5);
    this.scene.add(this.blastDoorMesh);

    this.blastDoorCollider = {
      minX: -2.8,
      maxX: 2.8,
      minZ: -15.85,
      maxZ: -15.15,
      disabled: false,
    };
    this.colliders.push(this.blastDoorCollider);

    // 8 Wing Sectors Outer Walls
    for (const b of Object.values(SECTOR_BOUNDS)) {
      const isWest = b.x < 0;
      const x1 = b.x;
      const x2 = b.x + b.w;
      const z1 = b.z;
      const z2 = b.z + b.d;
      if (isWest) {
        this._addWall(x1 - 0.7, -5.6, z1 - 0.6, z1, 3.0, 0x1a2840, 0x38bdf8);
        this._addWall(x1 - 0.7, -5.6, z2, z2 + 0.6, 3.0, 0x1a2840, 0x38bdf8);
        this._addWall(x1 - 0.7, x1, z1 - 0.6, z2 + 0.6, 3.0, 0x1a2840, 0x38bdf8);
      } else {
        this._addWall(5.6, x2 + 0.7, z1 - 0.6, z1, 3.0, 0x1a2840, 0x38bdf8);
        this._addWall(5.6, x2 + 0.7, z2, z2 + 0.6, 3.0, 0x1a2840, 0x38bdf8);
        this._addWall(x2, x2 + 0.7, z1 - 0.6, z2 + 0.6, 3.0, 0x1a2840, 0x38bdf8);
      }
    }

    // Reactor Area (X: -6..6, Z: -31.5..-15.5)
    this._addWall(-6.7, -6.0, -31.5, -15.5, 3.4, 0x3b1f28, 0xff5500);
    this._addWall(6.0, 6.7, -31.5, -15.5, 3.4, 0x3b1f28, 0xff5500);
    this._addWall(-6.7, -2.8, -31.9, -31.1, 3.4, 0x3b1f28, 0xff5500);
    this._addWall(2.8, 6.7, -31.9, -31.1, 3.4, 0x3b1f28, 0xff5500);

    // Escape Pod Room (X: -6..6, Z: -41.5..-31.5)
    this._addWall(-6.7, -6.0, -42.2, -31.5, 3.4, 0x1a3846, 0x00ff9d);
    this._addWall(6.0, 6.7, -42.2, -31.5, 3.4, 0x1a3846, 0x00ff9d);
    this._addWall(-6.7, 6.7, -42.2, -41.5, 3.4, 0x1a3846, 0x00ff9d);
  }

  _buildTrussesAndFloorGuides() {
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.75,
      roughness: 0.3,
    });

    // Overhead corridor rib beams for realistic station framing
    for (const z of [9.5, 2.0, -6.0, -14.0, -23.5, -31.5]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.24, 0.28), trussMat);
      beam.position.set(0, 3.25, z);
      this.scene.add(beam);
    }

    // Glowing floor conduit strips in Central Corridor
    const addFloorStrip = (x, z, w, d, colorHex) => {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.025, d),
        new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.75 })
      );
      strip.position.set(x, 0.015, z);
      this.scene.add(strip);
    };

    // Center North guide strip toward Blast Door
    addFloorStrip(-1.0, -3.0, 0.1, 24.0, 0x00f0ff);
    addFloorStrip(1.0, -3.0, 0.1, 24.0, 0xffaa00);

    // Side branch floor strips into each Sector doorway (uniform cyan so no room stands out)
    for (const b of Object.values(SECTOR_BOUNDS)) {
      const isWest = b.x < 0;
      const sx = isWest ? -3.5 : 3.5;
      addFloorStrip(sx, b.doorZ, 4.8, 0.09, UNIFORM_ROOM_HEX);
    }
  }

  _buildStaticPropsAndLights() {
    this.scene.add(new THREE.AmbientLight(0x88b4e8, 0.8));

    const dirLight = new THREE.DirectionalLight(0xcceeff, 1.05);
    dirLight.position.set(12, 26, 14);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(dirLight);

    const lights = [
      [0, 3.2, 14.0, 0x00e5ff, 2.2, 16],
      [0, 3.2, 2.0, 0x60a5fa, 2.3, 18],
      [0, 3.2, -9.0, 0x60a5fa, 2.3, 18],
      [0, 3.6, -23.5, 0xff5500, 3.0, 18],
      [0, 3.4, -36.5, 0x00ff9d, 2.5, 16],
    ];
    for (const [x, y, z, color, intensity, dist] of lights) {
      const pl = new THREE.PointLight(color, intensity, dist);
      pl.position.set(x, y, z);
      this.scene.add(pl);
    }

    for (const b of Object.values(SECTOR_BOUNDS)) {
      const pl = new THREE.PointLight(0x38bdf8, 1.8, 14);
      pl.position.set(b.labelX, 3.1, b.labelZ);
      this.scene.add(pl);
    }

    // Cryo-Pod Capsule + Start Anchor Ring
    this._addPropBox(this.scene, -1.3, 1.3, 16.4, 18.0, 2.2, 0x1e293b, 0x004466);
    const startPad = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.45, 28),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
    );
    startPad.rotation.x = -Math.PI / 2;
    startPad.position.set(0, 0.03, 14.0);
    this.scene.add(startPad);

    // Solid Central Corridor Shield Pylon Obstacles (split corridor into tactical lanes)
    for (const [z1, z2] of [
      [0.6, 2.2],
      [-7.4, -5.8],
    ]) {
      this._addPropBox(this.scene, -0.95, 0.95, z1, z2, 1.55, 0x1e293b, 0x004466);
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(1.94, 0.08, z2 - z1 + 0.04),
        new THREE.MeshBasicMaterial({ color: 0xffaa00 })
      );
      trim.position.set(0, 1.58, (z1 + z2) / 2);
      this.scene.add(trim);
    }

    // Solid Interior Cover Barricades inside all 8 Wing Sectors (player weaves left/right around cover)
    for (const b of Object.values(SECTOR_BOUNDS)) {
      const isWest = b.x < 0;
      const ox = isWest ? -10.4 : 10.4;
      const cz = b.z + b.d / 2;
      this._addPropBox(this.scene, ox - 0.55, ox + 0.55, cz - 1.15, cz + 1.15, 1.35, 0x1a2740, 0x005577);
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(1.14, 0.07, 2.34),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      cap.position.set(ox, 1.38, cz);
      this.scene.add(cap);
    }

    // Temporal Stabilizer (+5s orb) in NE corner of Central Corridor
    const stabGeo = new THREE.OctahedronGeometry(0.45, 1);
    const stabMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.92,
    });
    this.stabilizerMesh = new THREE.Mesh(stabGeo, stabMat);
    this.stabilizerMesh.position.set(this.stabilizerPos.x, 1.25, this.stabilizerPos.z);
    this.scene.add(this.stabilizerMesh);

    // Reactor Overhead Rings
    for (let i = 0; i < 3; i++) {
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(2.2 - i * 0.4, 0.09, 10, 32),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xff5500 : 0xffaa00 })
      );
      torus.position.set(0, 3.6, -23.5);
      torus.rotation.x = Math.PI / 2 + i * 0.35;
      this.scene.add(torus);
      this.reactorRings.push(torus);
    }
  }

  _buildStaticInteractables() {
    // Blast Door Override Terminal (Central Corridor North: -3.8, -14.2)
    this._addPropBox(this.scene, -4.4, -3.2, -14.7, -13.7, 1.2, 0x2b2418);
    this.blastTerminalMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff8800,
      emissiveIntensity: 1.2,
    });
    const blastScreen = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.7, 0.18), this.blastTerminalMat);
    blastScreen.position.set(-3.8, 1.65, -14.2);
    this.scene.add(blastScreen);

    // Escape Rocket with Open Cockpit Seat & Launchpad (0, -37.5)
    this.escapePodGroup = new THREE.Group();
    this.escapePodGroup.position.set(0, 0, -37.5);

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.55,
      roughness: 0.25,
    });
    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.75,
      roughness: 0.3,
    });
    const trimCyan = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00aacc,
      emissiveIntensity: 0.7,
    });

    // Lower Rocket Fuselage & Thruster Skirt
    const lowerHull = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.45, 1.65, 20), hullMat);
    lowerHull.position.y = 1.05;
    this.escapePodGroup.add(lowerHull);

    // Main Engine Bell + Detachable Side Booster Pods
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.95, 0.7, 16), darkMetal);
    nozzle.position.y = 0.25;
    this.escapePodGroup.add(nozzle);

    const buildSideBooster = (sx) => {
      const grp = new THREE.Group();
      grp.position.set(sx, 0, 0);
      const booster = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 2.2, 12), hullMat);
      booster.position.y = 1.4;
      const bStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.32, 0.2, 12), trimCyan);
      bStripe.position.y = 2.0;
      const bCone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.65, 12), trimCyan);
      bCone.position.y = 2.82;
      const bNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.35, 10), darkMetal);
      bNozzle.position.y = 0.15;
      const bFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.28, 1.8, 10),
        new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.9 })
      );
      bFlame.rotation.x = Math.PI;
      bFlame.position.y = -0.9;
      bFlame.visible = false;
      grp.add(booster, bStripe, bCone, bNozzle, bFlame);
      this.escapePodGroup.add(grp);
      return { grp, bFlame };
    };

    const leftB = buildSideBooster(-1.45);
    const rightB = buildSideBooster(1.45);
    this.leftBoosterGroup = leftB.grp;
    this.leftBoosterFlame = leftB.bFlame;
    this.rightBoosterGroup = rightB.grp;
    this.rightBoosterFlame = rightB.bFlame;

    // 4 Swept Aerodynamic Tail Fins
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.35, 0.85), darkMetal);
      fin.position.set(Math.sin(angle) * 1.42, 0.95, Math.cos(angle) * 1.42);
      fin.rotation.y = angle;
      this.escapePodGroup.add(fin);
    }

    // Open Cockpit Bay (rear backrest shell + floor platform so astronaut is clearly visible!)
    const cockpitBack = new THREE.Mesh(
      new THREE.CylinderGeometry(1.12, 1.15, 1.4, 20, 1, false, Math.PI * 0.65, Math.PI * 0.7),
      hullMat
    );
    cockpitBack.position.y = 2.55;
    this.escapePodGroup.add(cockpitBack);

    const cockpitFloor = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.12, 0.16, 20), darkMetal);
    cockpitFloor.position.y = 1.88;
    this.escapePodGroup.add(cockpitFloor);

    // Pilot Seat + Flight Controls inside Cockpit
    const seatCushion = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.16, 0.7), darkMetal);
    seatCushion.position.set(0, 2.02, 0.05);
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.95, 0.16), darkMetal);
    seatBack.position.set(0, 2.48, -0.26);
    const consoleDash = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 0.22), trimCyan);
    consoleDash.position.set(0, 2.25, 0.56);
    this.escapePodGroup.add(seatCushion, seatBack, consoleDash);

    // Seat anchor where astronaut sits visibly during launch!
    this.pilotSeatAnchor = new THREE.Group();
    this.pilotSeatAnchor.position.set(0, 1.85, 0.12);
    this.escapePodGroup.add(this.pilotSeatAnchor);

    // Glass Canopy Dome (starts raised/open, slides closed when astronaut sits inside!)
    this.rocketCanopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.14, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
      new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        emissive: 0x0284c7,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.38,
        roughness: 0.1,
        metalness: 0.2,
      })
    );
    this.rocketCanopy.position.set(0, 3.15, -0.45);
    this.rocketCanopy.rotation.x = -0.65;
    this.escapePodGroup.add(this.rocketCanopy);

    // Upper Rocket Nosecone above Cockpit
    const podNose = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.55, 20), hullMat);
    podNose.position.y = 4.25;
    const noseTip = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.65, 16), trimCyan);
    noseTip.position.y = 5.15;
    this.escapePodGroup.add(podNose, noseTip);

    // Status Beacon Ring
    this.escapePodBeaconMat = new THREE.MeshStandardMaterial({
      color: 0xff3b5c,
      emissive: 0xff2244,
      emissiveIntensity: 1.3,
    });
    const podRing = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.09, 10, 28), this.escapePodBeaconMat);
    podRing.rotation.x = Math.PI / 2;
    podRing.position.y = 1.65;
    this.escapePodGroup.add(podRing);

    // Multi-layered Rocket Exhaust Plume + Mach-Diamond Shock Core
    this.escapePodFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 3.0, 14),
      new THREE.MeshBasicMaterial({ color: 0xe0f7ff, transparent: true, opacity: 0.96 })
    );
    this.escapePodFlame.rotation.x = Math.PI;
    this.escapePodFlame.position.y = -1.55;
    this.escapePodFlame.visible = false;

    this.escapePodOuterFlame = new THREE.Mesh(
      new THREE.ConeGeometry(1.18, 4.9, 14),
      new THREE.MeshBasicMaterial({ color: 0xff7722, transparent: true, opacity: 0.66 })
    );
    this.escapePodOuterFlame.rotation.x = Math.PI;
    this.escapePodOuterFlame.position.y = -2.45;
    this.escapePodOuterFlame.visible = false;

    this.escapePodShockCone = new THREE.Mesh(
      new THREE.ConeGeometry(1.75, 1.2, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
      })
    );
    this.escapePodShockCone.position.y = 3.2;
    this.escapePodShockCone.visible = false;

    this.escapePodGroup.add(this.escapePodFlame, this.escapePodOuterFlame, this.escapePodShockCone);

    this.escapePodLight = new THREE.PointLight(0xff3b5c, 2.2, 10);
    this.escapePodLight.position.set(0, 2.5, 1.6);
    this.escapePodGroup.add(this.escapePodLight);

    this.scene.add(this.escapePodGroup);

    // Launchpad Blast Deflector Ring & Retractable Umbilical Gantry Tower
    const padRing = new THREE.Mesh(
      new THREE.RingGeometry(1.75, 2.35, 32),
      new THREE.MeshBasicMaterial({ color: 0x00ff9d, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
    );
    padRing.rotation.x = -Math.PI / 2;
    padRing.position.set(0, 0.03, -37.5);
    this.scene.add(padRing);

    const gantryMat = new THREE.MeshStandardMaterial({ color: 0x24324a, metalness: 0.75, roughness: 0.35 });
    const gantryTower = new THREE.Mesh(new THREE.BoxGeometry(0.65, 5.2, 0.65), gantryMat);
    gantryTower.position.set(-2.55, 2.6, -37.5);
    const gantryRightTower = new THREE.Mesh(new THREE.BoxGeometry(0.65, 5.2, 0.65), gantryMat);
    gantryRightTower.position.set(2.55, 2.6, -37.5);
    this.scene.add(gantryTower, gantryRightTower);

    this.gantryArmLeft = new THREE.Group();
    this.gantryArmLeft.position.set(-2.25, 2.9, -37.5);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.22, 0.3), gantryMat);
    armL.position.x = 0.62;
    this.gantryArmLeft.add(armL);

    this.gantryArmRight = new THREE.Group();
    this.gantryArmRight.position.set(2.25, 2.9, -37.5);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.22, 0.3), gantryMat);
    armR.position.x = -0.62;
    this.gantryArmRight.add(armR);
    this.scene.add(this.gantryArmLeft, this.gantryArmRight);

    this.colliders.push({
      minX: -1.6,
      maxX: 1.6,
      minZ: -39.1,
      maxZ: -35.9,
      disabled: false,
    });
  }

  _addSign(targetGroup, x, y, z, rotY, title, subtitle, color) {
    const tex = createSignTexture(title, subtitle, color);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.1, 0.96),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    targetGroup.add(mesh);
  }

  _buildStaticSigns() {
    this._addSign(this.scene, 0, 2.75, 10.0, 0, 'CENTRAL CORRIDOR', 'SECTORS A - H', '#38bdf8');
    for (const [sectorId, b] of Object.entries(SECTOR_BOUNDS)) {
      const isWest = b.x < 0;
      const sx = isWest ? -5.5 : 5.5;
      const rotY = isWest ? Math.PI / 2 : -Math.PI / 2;
      this._addSign(this.scene, sx, 2.65, b.doorZ, rotY, `SECTOR ${sectorId}`, 'EXPLORE WING', '#94a3b8');
    }
    this._addSign(this.scene, 0, 2.85, -15.0, 0, 'BLAST DOOR', 'KEYPAD OVERRIDE REQUIRED', '#ffaa00');
    this._addSign(this.scene, 0, 2.85, -31.0, 0, 'ESCAPE POD BAY', 'FINAL EXTRACTION [E]', '#00ff9d');
  }

  _addHoloRingFloor(x, z, colorHex) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.15, 28),
      new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.72 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.03, z);
    this.dynamicGroup.add(ring);
  }

  _addSideProps(sectorId, b, role) {
    const isWest = b.x < 0;
    const cornerX = isWest ? -17.0 : 17.0;
    const cz = b.z + b.d / 2;
    const color = ROLE_VISUALS[role].hex;

    // Two clean decorative corner pillars/vats/crates per room so rooms feel lived-in
    for (const dz of [-2.2, 2.2]) {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.48, 1.9, 10),
        new THREE.MeshStandardMaterial({
          color: 0x162438,
          emissive: color,
          emissiveIntensity: 0.25,
          metalness: 0.65,
          roughness: 0.35,
        })
      );
      pillar.position.set(cornerX, 0.95, cz + dz);
      this.dynamicGroup.add(pillar);
    }
  }

  configureForRun(state) {
    while (this.dynamicGroup.children.length > 0) {
      this.dynamicGroup.remove(this.dynamicGroup.children[0]);
    }
    this.interactables = [];
    this.holoSpinners = [];
    this.decoyScreens = {};

    for (const [sectorId, role] of Object.entries(state.sectorAssignments)) {
      const b = SECTOR_BOUNDS[sectorId];
      const isWest = b.x < 0;
      const termX = isWest ? -14.8 : 14.8;
      const termZ = b.z + b.d / 2;
      const wallSignX = isWest ? -17.85 : 17.85;
      const signRotY = isWest ? Math.PI / 2 : -Math.PI / 2;
      const vis = ROLE_VISUALS[role];

      // Neutral-colored interior sign (same cyan color across all 8 rooms!)
      this._addSign(
        this.dynamicGroup,
        wallSignX,
        2.45,
        termZ,
        signRotY,
        `SECTOR ${sectorId}`,
        'INSPECT TERMINAL [E]',
        UNIFORM_ROOM_CSS
      );

      this._addSideProps(sectorId, b, role);
      this._addHoloRingFloor(termX, termZ, UNIFORM_ROOM_HEX);

      // Console pedestal
      this._addPropBox(
        this.dynamicGroup,
        termX - 0.7,
        termX + 0.7,
        termZ - 0.8,
        termZ + 0.8,
        1.15,
        0x162438,
        0x000000,
        false
      );

      if (role === 'keycard') {
        this.keycardMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.36, 0.08),
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x00d4ff,
            emissiveIntensity: 1.3,
          })
        );
        this.keycardMesh.position.set(termX, 1.65, termZ);
        this.dynamicGroup.add(this.keycardMesh);

        this.interactables.push({
          id: 'keycard',
          sectorId,
          position: new THREE.Vector3(termX, 0, termZ),
          range: 2.9,
          getPrompt: (s) =>
            s.memory.keycardObtained
              ? 'Quantum Keycard Already Equipped in Right Hand'
              : 'Inspect Pedestal / Equip Quantum Keycard',
        });
      } else if (role === 'telemetry') {
        this.telemetryScreenMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 1.2,
        });
        const scr = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 0.2), this.telemetryScreenMat);
        scr.position.set(termX, 1.7, termZ);
        scr.rotation.y = Math.PI / 2;
        this.dynamicGroup.add(scr);

        const globe = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.46, 1),
          new THREE.MeshBasicMaterial({ color: UNIFORM_ROOM_HEX, wireframe: true })
        );
        globe.position.set(termX, 2.55, termZ);
        this.dynamicGroup.add(globe);
        this.holoSpinners.push(globe);

        this.interactables.push({
          id: 'telemetry',
          sectorId,
          position: new THREE.Vector3(termX, 0, termZ),
          range: 2.9,
          getPrompt: (s) =>
            s.memory.telemetryScanned
              ? 'Telemetry Mapped (Reactor Mines Revealed)'
              : 'Access Sector Terminal',
        });
      } else if (role === 'security') {
        this.securityScreenMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 1.2,
        });
        const scr = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 0.2), this.securityScreenMat);
        scr.position.set(termX, 1.7, termZ);
        scr.rotation.y = Math.PI / 2;
        this.dynamicGroup.add(scr);

        const prism = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.46, 1),
          new THREE.MeshBasicMaterial({ color: UNIFORM_ROOM_HEX, wireframe: true })
        );
        prism.position.set(termX, 2.55, termZ);
        this.dynamicGroup.add(prism);
        this.holoSpinners.push(prism);

        this.interactables.push({
          id: 'security',
          sectorId,
          position: new THREE.Vector3(termX, 0, termZ),
          range: 2.9,
          getPrompt: (s) =>
            s.memory.securityCodeFound
              ? `Security Cipher Stored: ${s.securityCodeValue}`
              : 'Access Sector Terminal',
        });
      } else if (role === 'booster') {
        this.boosterScreenMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 1.2,
        });
        const scr = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 0.2), this.boosterScreenMat);
        scr.position.set(termX, 1.7, termZ);
        scr.rotation.y = Math.PI / 2;
        this.dynamicGroup.add(scr);

        const holo = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.46, 1),
          new THREE.MeshBasicMaterial({ color: UNIFORM_ROOM_HEX, wireframe: true })
        );
        holo.position.set(termX, 2.55, termZ);
        this.dynamicGroup.add(holo);
        this.holoSpinners.push(holo);

        this.interactables.push({
          id: 'booster',
          sectorId,
          position: new THREE.Vector3(termX, 0, termZ),
          range: 2.9,
          getPrompt: (s) =>
            s.boosterUsedThisLoop
              ? 'Temporal Relay Cooling Down Until Next Loop'
              : 'Access Sector Terminal',
        });
      } else {
        // Decoy Terminal — looks 100% identical to real terminals until inspected!
        const decoyScreenMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 1.2,
        });
        this.decoyScreens[sectorId] = decoyScreenMat;
        const scr = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 0.2), decoyScreenMat);
        scr.position.set(termX, 1.7, termZ);
        scr.rotation.y = Math.PI / 2;
        this.dynamicGroup.add(scr);

        const holo = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.46, 1),
          new THREE.MeshBasicMaterial({ color: UNIFORM_ROOM_HEX, wireframe: true })
        );
        holo.position.set(termX, 2.55, termZ);
        this.dynamicGroup.add(holo);
        this.holoSpinners.push(holo);

        this.interactables.push({
          id: role,
          sectorId,
          position: new THREE.Vector3(termX, 0, termZ),
          range: 2.9,
          getPrompt: (s) =>
            s.discoveredSectors[sectorId]
              ? `${vis.title} (DECOY — Checked)`
              : 'Access Sector Terminal',
        });
      }
    }

    // Static interactables
    this.interactables.push({
      id: 'stabilizer',
      position: this.stabilizerPos.clone(),
      range: 2.2,
      getPrompt: (s) =>
        s.stabilizerCollectedThisLoop ? null : 'Absorb +5.0s Temporal Stabilizer',
    });

    this.interactables.push({
      id: 'blastdoor',
      position: new THREE.Vector3(-3.8, 0, -14.2),
      range: 2.8,
      getPrompt: (s) =>
        s.memory.blastDoorUnlocked
          ? 'Blast Door Permanently Unlocked'
          : 'Open Blast Door Keypad Interface',
    });

    this.interactables.push({
      id: 'escapepod',
      position: new THREE.Vector3(0, 0, -37.5),
      range: 3.4,
      getPrompt: (s) => {
        const m = s.memory;
        if (m.telemetryScanned && m.securityCodeFound && m.keycardObtained && m.blastDoorUnlocked) {
          return 'LAUNCH ESCAPE POD — BREAK THE TIME LOOP!';
        }
        return 'Escape Pod Offline — Complete All 4 Memory Objectives';
      },
    });
  }

  getSectorAtPosition(pos) {
    for (const [sectorId, b] of Object.entries(SECTOR_BOUNDS)) {
      if (pos.x >= b.x && pos.x <= b.x + b.w && pos.z >= b.z && pos.z <= b.z + b.d) {
        return sectorId;
      }
    }
    return null;
  }

  getRoomName(pos, state) {
    const sectorId = this.getSectorAtPosition(pos);
    if (sectorId) {
      const discovered = state.discoveredSectors[sectorId];
      return discovered
        ? `SEC ${sectorId}: ${ROLE_VISUALS[discovered].title}`
        : `SECTOR ${sectorId} — UNVERIFIED`;
    }
    if (pos.z >= 9.5) return 'CRYO-POD BAY [S]';
    if (pos.z <= -31.5) return 'ESCAPE POD BAY [E]';
    if (pos.z <= -15.5) return 'REACTOR AREA';
    return 'CENTRAL CORRIDOR';
  }

  getNearestInteractable(pos, state) {
    let best = null;
    let bestDist = Infinity;
    for (const item of this.interactables) {
      if (item.id === 'stabilizer' && state.stabilizerCollectedThisLoop) continue;
      const d = Math.hypot(pos.x - item.position.x, pos.z - item.position.z);
      if (d <= item.range && d < bestDist) {
        bestDist = d;
        best = item;
      }
    }
    return best;
  }

  update(dt, state, elapsed) {
    if (this.starfield) this.starfield.rotation.y += dt * 0.008;
    if (this.heroStars) {
      this.heroStars.rotation.y += dt * 0.012;
      this.heroStars.material.opacity = 0.72 + Math.sin(elapsed * 2.2) * 0.22;
    }
    if (this.spacePlanet) this.spacePlanet.rotation.y += dt * 0.02;
    if (this.planetBody) this.planetBody.rotation.y += dt * 0.06;
    if (this.earthBody) this.earthBody.rotation.y += dt * 0.045;
    if (this.earthClouds) this.earthClouds.rotation.y += dt * 0.068;

    this.reactorRings.forEach((ring, idx) => {
      ring.rotation.z += dt * (0.7 + idx * 0.4);
      ring.rotation.y += dt * 0.35;
    });

    for (const spinner of this.holoSpinners) {
      spinner.rotation.y += dt * 1.4;
      spinner.rotation.x += dt * 0.6;
    }

    if (this.stabilizerMesh) {
      this.stabilizerMesh.visible = !state.stabilizerCollectedThisLoop;
      this.stabilizerMesh.rotation.y = elapsed * 2.5;
      this.stabilizerMesh.position.y = 1.2 + Math.sin(elapsed * 3.5) * 0.14;
    }

    if (this.keycardMesh) {
      this.keycardMesh.visible = !state.memory.keycardObtained;
      this.keycardMesh.rotation.y = elapsed * 2.4;
      this.keycardMesh.position.y = 1.65 + Math.sin(elapsed * 3) * 0.12;
    }

    if (this.telemetryScreenMat) {
      this.telemetryScreenMat.color.setHex(state.memory.telemetryScanned ? 0x00ff9d : 0x38bdf8);
      this.telemetryScreenMat.emissive.setHex(state.memory.telemetryScanned ? 0x00cc77 : 0x0284c7);
    }
    if (this.securityScreenMat) {
      this.securityScreenMat.color.setHex(state.memory.securityCodeFound ? 0x00ff9d : 0x38bdf8);
      this.securityScreenMat.emissive.setHex(state.memory.securityCodeFound ? 0x00cc77 : 0x0284c7);
    }
    if (this.boosterScreenMat) {
      this.boosterScreenMat.color.setHex(state.boosterUsedThisLoop ? 0x00ff9d : 0x38bdf8);
      this.boosterScreenMat.emissive.setHex(state.boosterUsedThisLoop ? 0x00cc77 : 0x0284c7);
    }
    if (this.decoyScreens) {
      for (const [sid, mat] of Object.entries(this.decoyScreens)) {
        const checked = Boolean(state.discoveredSectors[sid]);
        mat.color.setHex(checked ? 0xff3b5c : 0x38bdf8);
        mat.emissive.setHex(checked ? 0xaa1133 : 0x0284c7);
      }
    }

    this.blastTerminalMat.color.setHex(state.memory.blastDoorUnlocked ? 0x00ff9d : 0xffaa00);
    this.blastTerminalMat.emissive.setHex(state.memory.blastDoorUnlocked ? 0x00cc77 : 0xff8800);

    this.blastDoorCollider.disabled = state.memory.blastDoorUnlocked;
    const targetOpen = state.memory.blastDoorUnlocked ? 1 : 0;
    this.blastDoorOpenAmount += (targetOpen - this.blastDoorOpenAmount) * Math.min(1, dt * 6);
    this.blastDoorMesh.position.y = 1.5 + this.blastDoorOpenAmount * 3.2;

    const ready =
      state.memory.telemetryScanned &&
      state.memory.securityCodeFound &&
      state.memory.keycardObtained &&
      state.memory.blastDoorUnlocked;
    if (ready) {
      this.escapePodBeaconMat.color.setHex(0x00ff9d);
      this.escapePodBeaconMat.emissive.setHex(0x00ff9d);
      this.escapePodLight.color.setHex(0x00ff9d);
      this.escapePodLight.intensity = 2.6 + Math.sin(elapsed * 5) * 0.6;
    } else {
      this.escapePodBeaconMat.color.setHex(0xff3b5c);
      this.escapePodBeaconMat.emissive.setHex(0xff2244);
      this.escapePodLight.color.setHex(0xff3b5c);
      this.escapePodLight.intensity = 1.6;
    }

    if (state.phase === 'launching' || state.phase === 'victory') {
      // Handled smoothly by main.js multi-stage launch sequence
    } else {
      this.escapePodFlame.visible = false;
      this.escapePodOuterFlame.visible = false;
      this.escapePodShockCone.visible = false;
      this.leftBoosterFlame.visible = false;
      this.rightBoosterFlame.visible = false;
      this.leftBoosterGroup.position.set(-1.45, 0, 0);
      this.leftBoosterGroup.rotation.set(0, 0, 0);
      this.rightBoosterGroup.position.set(1.45, 0, 0);
      this.rightBoosterGroup.rotation.set(0, 0, 0);
      this.gantryArmLeft.rotation.y = 0;
      this.gantryArmRight.rotation.y = 0;
      this.escapePodGroup.position.set(0, 0, -37.5);
      this.escapePodGroup.rotation.set(0, 0, 0);
      this.rocketCanopy.position.set(0, 3.15, -0.45);
      this.rocketCanopy.rotation.x = -0.65;
    }
  }
}
