import * as THREE from 'three';
import { SECTOR_BOUNDS } from './minimap.js';

// Reactor Area spans Z: [-31.5, -15.5]
export const REACTOR_PRESETS = [
  {
    safePoints: [
      [0, -16.7],
      [2.2, -19.0],
      [2.2, -22.0],
      [-2.0, -24.5],
      [-1.8, -27.3],
      [0, -29.5],
    ],
    mines: [
      [-2.6, -18.3],
      [-0.8, -20.7],
      [2.8, -25.0],
      [-3.0, -21.5],
      [1.8, -27.7],
      [-3.2, -28.0],
    ],
  },
  {
    safePoints: [
      [0, -16.7],
      [-2.2, -19.0],
      [-2.2, -22.0],
      [2.0, -24.5],
      [1.8, -27.3],
      [0, -29.5],
    ],
    mines: [
      [2.6, -18.3],
      [0.8, -20.7],
      [-2.8, -25.0],
      [3.0, -21.5],
      [-1.8, -27.7],
      [3.2, -28.0],
    ],
  },
  {
    safePoints: [
      [0, -16.7],
      [-1.6, -19.7],
      [1.8, -23.3],
      [-1.6, -26.7],
      [0, -29.5],
    ],
    mines: [
      [2.5, -18.5],
      [-3.4, -22.7],
      [3.2, -20.3],
      [-2.2, -23.7],
      [2.6, -27.0],
      [-3.0, -28.3],
    ],
  },
];

export class HazardSystem {
  constructor(scene) {
    this.scene = scene;
    this.minesGroup = new THREE.Group();
    this.safeRouteGroup = new THREE.Group();
    this.scene.add(this.minesGroup, this.safeRouteGroup);

    this.mines = [];
    this.safePoints = [];
    this.reactorZones = [];
    this.patrolDrones = [];
    this.plasmaVents = [];
    this.laserBarrier = null;
    this.reactorGate = null;
    this.elapsed = 0;

    this._buildSecurityLaserBarrier();
    this._buildReactorExitGate();
    this._buildReactorDangerZones();
    this._buildPatrolDrones();
    this._buildPlasmaVents();
  }

  _buildSecurityLaserBarrier() {
    const group = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xff2a55,
      transparent: true,
      opacity: 0.9,
    });
    const warnMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.45,
    });

    const beams = [];
    for (let y = 0.55; y <= 1.85; y += 0.65) {
      const geo = new THREE.CylinderGeometry(0.06, 0.06, 4.0, 8);
      const mesh = new THREE.Mesh(geo, beamMat);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(0, y, 0);
      group.add(mesh);
      beams.push(mesh);
    }

    const stripGeo = new THREE.BoxGeometry(0.5, 0.04, 4.0);
    const strip = new THREE.Mesh(stripGeo, warnMat);
    strip.position.set(0, 0.02, 0);
    group.add(strip);

    const laserLight = new THREE.PointLight(0xff2a55, 2.2, 6);
    laserLight.position.set(0, 1.5, 0);
    group.add(laserLight);

    this.scene.add(group);
    this.laserBarrier = {
      group,
      beams,
      strip,
      light: laserLight,
      minX: -6.28,
      maxX: -5.72,
      minZ: -4.5,
      maxZ: -0.5,
    };
  }

  _buildReactorExitGate() {
    // Periodic pulse laser across Reactor exit doorway (Z = -30.9, X: [-2.8, 2.8])
    const group = new THREE.Group();
    group.position.set(0, 0, -30.9);

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.9,
    });
    const stripMat = new THREE.MeshBasicMaterial({
      color: 0x00ff9d,
      transparent: true,
      opacity: 0.5,
    });

    const beams = [];
    for (let y = 0.6; y <= 1.8; y += 0.6) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 5.5, 8), beamMat);
      mesh.rotation.z = Math.PI / 2;
      mesh.position.set(0, y, 0);
      group.add(mesh);
      beams.push(mesh);
    }

    const strip = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.04, 0.45), stripMat);
    strip.position.set(0, 0.02, 0);
    group.add(strip);

    this.scene.add(group);
    this.reactorGate = {
      group,
      beams,
      strip,
      minX: -2.75,
      maxX: 2.75,
      minZ: -31.18,
      maxZ: -30.62,
    };
  }

  _buildReactorDangerZones() {
    const zones = [
      [-4.9, -26.0, 1.15],
      [4.9, -20.0, 1.15],
    ];

    for (const [x, z, r] of zones) {
      const ringGeo = new THREE.RingGeometry(0.4, r, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff7700,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.035, z);
      this.scene.add(ring);

      const pylonGeo = new THREE.CylinderGeometry(0.32, 0.42, 2.2, 10);
      const pylonMat = new THREE.MeshStandardMaterial({
        color: 0x2a1810,
        emissive: 0xff5500,
        emissiveIntensity: 0.8,
      });
      const pylon = new THREE.Mesh(pylonGeo, pylonMat);
      pylon.position.set(x, 1.1, z);
      this.scene.add(pylon);

      this.reactorZones.push({ x, z, radius: r * 0.82, ring, ringMat });
    }
  }

  _buildPatrolDrones() {
    // 3 Moving Security Patrol Drones sweeping across the Central Corridor
    const specs = [
      { z: 5.5, speed: 1.45, phase: 0.0, amp: 4.1 },
      { z: -2.5, speed: 1.65, phase: 1.8, amp: 4.1 },
      { z: -10.5, speed: 1.8, phase: 3.4, amp: 4.1 },
    ];

    for (const sp of specs) {
      const group = new THREE.Group();
      group.position.set(0, 0, sp.z);

      const hull = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 16, 12),
        new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          metalness: 0.75,
          roughness: 0.25,
        })
      );
      hull.position.y = 1.1;

      const eye = new THREE.Mesh(
        new THREE.TorusGeometry(0.48, 0.06, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xff2a55 })
      );
      eye.rotation.x = Math.PI / 2;
      eye.position.y = 1.1;

      const dangerRing = new THREE.Mesh(
        new THREE.RingGeometry(0.58, 0.76, 24),
        new THREE.MeshBasicMaterial({
          color: 0xff2a55,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.78,
        })
      );
      dangerRing.rotation.x = -Math.PI / 2;
      dangerRing.position.y = 0.04;

      const light = new THREE.PointLight(0xff2a55, 1.5, 5);
      light.position.set(0, 1.4, 0);

      group.add(hull, eye, dangerRing, light);
      this.scene.add(group);

      this.patrolDrones.push({
        group,
        z: sp.z,
        speed: sp.speed,
        phase: sp.phase,
        amp: sp.amp,
        radius: 0.62,
      });
    }
  }

  _buildPlasmaVents() {
    // 2 Periodic Plasma Steam Vents in Central Corridor side lanes
    const vents = [
      { x: -3.6, z: -5.5, offset: 0.0 },
      { x: 3.6, z: 1.5, offset: 2.0 },
    ];

    for (const v of vents) {
      const group = new THREE.Group();
      group.position.set(v.x, 0, v.z);

      const grate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 1.05, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.4 })
      );
      grate.position.y = 0.04;

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ff9d,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.98, 24), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;

      const jetMat = new THREE.MeshBasicMaterial({
        color: 0xff5500,
        transparent: true,
        opacity: 0.75,
      });
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.75, 2.4, 14), jetMat);
      jet.position.y = 1.2;
      jet.visible = false;

      group.add(grate, ring, jet);
      this.scene.add(group);

      this.plasmaVents.push({
        x: v.x,
        z: v.z,
        offset: v.offset,
        radius: 0.85,
        ringMat,
        jet,
      });
    }
  }

  configureForRun(securitySectorId, routePresetIndex) {
    const b = SECTOR_BOUNDS[securitySectorId];
    const doorX = b.x < 0 ? -6.0 : 6.0;
    const doorZ = b.doorZ;
    this.laserBarrier.group.position.set(doorX, 0, doorZ);
    this.laserBarrier.minX = doorX - 0.28;
    this.laserBarrier.maxX = doorX + 0.28;
    this.laserBarrier.minZ = doorZ - 1.95;
    this.laserBarrier.maxZ = doorZ + 1.95;

    while (this.minesGroup.children.length > 0) {
      this.minesGroup.remove(this.minesGroup.children[0]);
    }
    while (this.safeRouteGroup.children.length > 0) {
      this.safeRouteGroup.remove(this.safeRouteGroup.children[0]);
    }
    this.mines = [];

    const preset = REACTOR_PRESETS[routePresetIndex % REACTOR_PRESETS.length];
    this.safePoints = preset.safePoints;

    for (const [x, z] of preset.mines) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      const stealthRing = new THREE.Mesh(
        new THREE.RingGeometry(0.35, 0.55, 20),
        new THREE.MeshBasicMaterial({
          color: 0xa855f7,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.16,
        })
      );
      stealthRing.rotation.x = -Math.PI / 2;
      stealthRing.position.y = 0.03;
      group.add(stealthRing);

      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.42, 0),
        new THREE.MeshStandardMaterial({
          color: 0xff2244,
          emissive: 0xff1133,
          emissiveIntensity: 1.5,
          roughness: 0.2,
        })
      );
      core.position.y = 0.52;
      core.visible = false;
      group.add(core);

      const warnRing = new THREE.Mesh(
        new THREE.RingGeometry(0.7, 0.88, 24),
        new THREE.MeshBasicMaterial({
          color: 0xff3b5c,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        })
      );
      warnRing.rotation.x = -Math.PI / 2;
      warnRing.position.y = 0.04;
      warnRing.visible = false;
      group.add(warnRing);

      this.minesGroup.add(group);
      this.mines.push({ x, z, radius: 0.78, group, core, warnRing, stealthRing });
    }

    const safeMat = new THREE.MeshBasicMaterial({
      color: 0x00ff9d,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    for (const [x, z] of preset.safePoints) {
      const disc = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.46, 6), safeMat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(x, 0.04, z);
      this.safeRouteGroup.add(disc);
    }
    this.safeRouteGroup.visible = false;
  }

  resetLoop() {
    this.elapsed = 0;
  }

  update(dt, telemetryScanned, playerPos, playerRadius) {
    this.elapsed += dt;

    const secCycle = this.elapsed % 4.5;
    const secWarning = secCycle >= 1.9 && secCycle < 2.5;
    const secActive = secCycle >= 2.5;

    for (const beam of this.laserBarrier.beams) beam.visible = secActive;
    this.laserBarrier.light.intensity = secActive ? 2.4 : secWarning ? 1.0 : 0.2;
    this.laserBarrier.strip.material.color.setHex(
      secActive ? 0xff2a55 : secWarning ? 0xffaa00 : 0x00ff9d
    );
    this.laserBarrier.strip.material.opacity = secWarning
      ? 0.35 + Math.abs(Math.sin(this.elapsed * 18)) * 0.55
      : 0.6;

    const gateCycle = (this.elapsed + 1.1) % 4.2;
    const gateWarning = gateCycle >= 2.1 && gateCycle < 2.8;
    const gateActive = gateCycle >= 2.8;

    for (const beam of this.reactorGate.beams) beam.visible = gateActive;
    this.reactorGate.strip.material.color.setHex(
      gateActive ? 0xff5500 : gateWarning ? 0xffaa00 : 0x00ff9d
    );
    this.reactorGate.strip.material.opacity = gateWarning
      ? 0.35 + Math.abs(Math.sin(this.elapsed * 18)) * 0.55
      : 0.6;

    this.safeRouteGroup.visible = telemetryScanned;
    if (telemetryScanned) {
      this.safeRouteGroup.children.forEach((child, idx) => {
        child.rotation.z = this.elapsed * 1.4 + idx * 0.4;
      });
    }

    for (const mine of this.mines) {
      mine.core.visible = telemetryScanned;
      mine.warnRing.visible = telemetryScanned;
      mine.stealthRing.visible = !telemetryScanned;

      if (telemetryScanned) {
        mine.core.rotation.y += dt * 2.2;
        mine.core.position.y = 0.52 + Math.sin(this.elapsed * 3.5 + mine.x) * 0.1;
        const pulse = 0.9 + Math.sin(this.elapsed * 5) * 0.12;
        mine.warnRing.scale.set(pulse, pulse, 1);
      } else {
        mine.stealthRing.material.opacity =
          0.1 + Math.abs(Math.sin(this.elapsed * 3 + mine.z)) * 0.14;
      }
    }

    for (const rz of this.reactorZones) {
      rz.ringMat.opacity = 0.4 + Math.abs(Math.sin(this.elapsed * 4)) * 0.4;
    }

    // 4b. Update Patrolling Security Drones
    for (const d of this.patrolDrones) {
      const x = Math.sin(this.elapsed * d.speed + d.phase) * d.amp;
      d.group.position.x = x;
      d.group.position.y = Math.sin(this.elapsed * 4 + d.phase) * 0.08;
      d.group.rotation.y += dt * 3.0;
    }

    // 4c. Update Periodic Plasma Vents (4.0s cycle: 2.1s safe, 0.7s amber warning, 1.2s active burst)
    for (const v of this.plasmaVents) {
      const cyc = (this.elapsed + v.offset) % 4.0;
      const warn = cyc >= 2.1 && cyc < 2.8;
      const active = cyc >= 2.8;
      v.active = active;
      v.jet.visible = active;
      if (active) {
        v.jet.scale.y = 0.9 + Math.sin(this.elapsed * 28) * 0.15;
        v.ringMat.color.setHex(0xff3b5c);
        v.ringMat.opacity = 0.9;
      } else if (warn) {
        v.ringMat.color.setHex(0xffaa00);
        v.ringMat.opacity = 0.35 + Math.abs(Math.sin(this.elapsed * 18)) * 0.55;
      } else {
        v.ringMat.color.setHex(0x00ff9d);
        v.ringMat.opacity = 0.45;
      }
    }

    if (secActive) {
      const lb = this.laserBarrier;
      if (
        playerPos.x + playerRadius > lb.minX &&
        playerPos.x - playerRadius < lb.maxX &&
        playerPos.z + playerRadius > lb.minZ &&
        playerPos.z - playerRadius < lb.maxZ
      ) {
        return { hit: true, reason: 'SECURITY LASER IMPACT!' };
      }
    }

    if (gateActive) {
      const rg = this.reactorGate;
      if (
        playerPos.x + playerRadius > rg.minX &&
        playerPos.x - playerRadius < rg.maxX &&
        playerPos.z + playerRadius > rg.minZ &&
        playerPos.z - playerRadius < rg.maxZ
      ) {
        return { hit: true, reason: 'REACTOR PULSE GATE IMPACT!' };
      }
    }

    for (const mine of this.mines) {
      const dist = Math.hypot(playerPos.x - mine.x, playerPos.z - mine.z);
      if (dist < mine.radius + playerRadius * 0.7) {
        return { hit: true, reason: 'PLASMA MINE DETONATION!' };
      }
    }

    for (const rz of this.reactorZones) {
      const dist = Math.hypot(playerPos.x - rz.x, playerPos.z - rz.z);
      if (dist < rz.radius + playerRadius * 0.7) {
        return { hit: true, reason: 'REACTOR RADIATION OVERLOAD!' };
      }
    }

    for (const d of this.patrolDrones) {
      const dist = Math.hypot(playerPos.x - d.group.position.x, playerPos.z - d.z);
      if (dist < d.radius + playerRadius * 0.7) {
        return { hit: true, reason: 'SECURITY PATROL DRONE IMPACT!' };
      }
    }

    for (const v of this.plasmaVents) {
      if (!v.active) continue;
      const dist = Math.hypot(playerPos.x - v.x, playerPos.z - v.z);
      if (dist < v.radius + playerRadius * 0.65) {
        return { hit: true, reason: 'CORRIDOR PLASMA VENT ERUPTION!' };
      }
    }

    return { hit: false, reason: null };
  }
}
