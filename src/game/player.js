import * as THREE from 'three';

export class AstronautPlayer {
  constructor(scene) {
    this.scene = scene;
    this.radius = 0.48;
    this.speed = 10.6;
    this.spawnPos = new THREE.Vector3(0, 0, 14.0);

    this.group = new THREE.Group();
    this.group.position.copy(this.spawnPos);

    this.handKeycardGroup = null;
    this.handScannerGroup = null;
    this.handCipherGroup = null;

    this._buildModel();
    this.scene.add(this.group);

    this.walkTime = 0;
    this.facingAngle = Math.PI; // Facing -Z (North)
    this.group.rotation.y = this.facingAngle;
  }

  _buildModel() {
    const suitMat = new THREE.MeshStandardMaterial({
      color: 0xe6f0ff,
      roughness: 0.35,
      metalness: 0.25,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x007799,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.5,
      metalness: 0.5,
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x0099bb,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.8,
    });

    // Legs
    const legGeo = new THREE.CapsuleGeometry(0.14, 0.36, 4, 8);
    this.leftLeg = new THREE.Mesh(legGeo, darkMat);
    this.leftLeg.position.set(-0.18, 0.34, 0);
    this.leftLeg.castShadow = true;

    this.rightLeg = new THREE.Mesh(legGeo, darkMat);
    this.rightLeg.position.set(0.18, 0.34, 0);
    this.rightLeg.castShadow = true;

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.62, 0.72, 0.42);
    this.torso = new THREE.Mesh(torsoGeo, suitMat);
    this.torso.position.set(0, 0.96, 0);
    this.torso.castShadow = true;

    // Chest Core Light
    const chestGeo = new THREE.BoxGeometry(0.24, 0.16, 0.08);
    const chestCore = new THREE.Mesh(chestGeo, accentMat);
    chestCore.position.set(0, 1.02, 0.22);

    // Jetpack
    const packGeo = new THREE.BoxGeometry(0.46, 0.56, 0.24);
    const jetpack = new THREE.Mesh(packGeo, darkMat);
    jetpack.position.set(0, 0.98, -0.28);
    jetpack.castShadow = true;

    const thrusterGeo = new THREE.CylinderGeometry(0.08, 0.11, 0.16, 8);
    const leftThruster = new THREE.Mesh(thrusterGeo, accentMat);
    leftThruster.position.set(-0.14, 0.68, -0.28);
    const rightThruster = new THREE.Mesh(thrusterGeo, accentMat);
    rightThruster.position.set(0.14, 0.68, -0.28);

    // Arms (pivoted near shoulders for natural swing + held items)
    const armGeo = new THREE.CapsuleGeometry(0.11, 0.36, 4, 8);

    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.44, 1.18, 0);
    const leftArmMesh = new THREE.Mesh(armGeo, suitMat);
    leftArmMesh.position.set(0, -0.22, 0);
    leftArmMesh.castShadow = true;
    this.leftArm.add(leftArmMesh);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.44, 1.18, 0);
    const rightArmMesh = new THREE.Mesh(armGeo, suitMat);
    rightArmMesh.position.set(0, -0.22, 0);
    rightArmMesh.castShadow = true;
    this.rightArm.add(rightArmMesh);

    // ===== IN-HAND HELD CLUE ITEMS =====
    // 1. Right Hand: Glowing Quantum Keycard
    this.handKeycardGroup = new THREE.Group();
    this.handKeycardGroup.position.set(0.04, -0.46, 0.22);
    const keycardMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.04, 0.28),
      new THREE.MeshStandardMaterial({
        color: 0x00ff9d,
        emissive: 0x00ff88,
        emissiveIntensity: 1.6,
        roughness: 0.2,
      })
    );
    const keycardGlow = new THREE.PointLight(0x00ff9d, 0.75, 2.6);
    this.handKeycardGroup.add(keycardMesh, keycardGlow);
    this.handKeycardGroup.visible = false;
    this.rightArm.add(this.handKeycardGroup);

    // 2. Left Hand: Glowing Cyan Telemetry Holo-Scanner Slate
    this.handScannerGroup = new THREE.Group();
    this.handScannerGroup.position.set(-0.04, -0.42, 0.22);
    const scannerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.04, 0.24),
      new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00d8ff,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.9,
      })
    );
    const scannerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.11, 0.15, 16),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide })
    );
    scannerRing.rotation.x = -Math.PI / 2;
    scannerRing.position.y = 0.05;
    this.handScannerGroup.add(scannerMesh, scannerRing);
    this.handScannerGroup.visible = false;
    this.leftArm.add(this.handScannerGroup);

    // 3. Left Wrist/Hand: Purple Security Cipher Chip
    this.handCipherGroup = new THREE.Group();
    this.handCipherGroup.position.set(-0.14, -0.32, 0.08);
    const cipherCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.09, 0),
      new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0xa855f7,
        emissiveIntensity: 1.6,
      })
    );
    this.handCipherGroup.add(cipherCore);
    this.handCipherGroup.visible = false;
    this.leftArm.add(this.handCipherGroup);

    // Helmet & Visor
    const headGeo = new THREE.SphereGeometry(0.32, 16, 14);
    this.head = new THREE.Mesh(headGeo, suitMat);
    this.head.position.set(0, 1.56, 0);
    this.head.castShadow = true;

    const visorGeo = new THREE.BoxGeometry(0.42, 0.24, 0.22);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.56, 0.2);

    // Subtle personal point light + glowing floor tracking ring under feet
    const playerLight = new THREE.PointLight(0x00e5ff, 1.3, 6.5);
    playerLight.position.set(0, 1.8, 0);

    this.footRing = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.56, 24),
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      })
    );
    this.footRing.rotation.x = -Math.PI / 2;
    this.footRing.position.y = 0.04;

    this.group.add(
      this.leftLeg,
      this.rightLeg,
      this.torso,
      chestCore,
      jetpack,
      leftThruster,
      rightThruster,
      this.leftArm,
      this.rightArm,
      this.head,
      visor,
      playerLight,
      this.footRing
    );
  }

  setSittingPose(sitting) {
    this.footRing.visible = !sitting;
    if (sitting) {
      this.leftLeg.rotation.x = -Math.PI / 2.2;
      this.rightLeg.rotation.x = -Math.PI / 2.2;
      this.leftLeg.position.set(-0.18, 0.56, 0.2);
      this.rightLeg.position.set(0.18, 0.56, 0.2);
      this.torso.position.y = 0.84;
      this.leftArm.rotation.x = -0.95;
      this.rightArm.rotation.x = -0.95;
      this.head.position.y = 1.44;
    } else {
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.leftLeg.position.set(-0.18, 0.34, 0);
      this.rightLeg.position.set(0.18, 0.34, 0);
      this.torso.position.y = 0.96;
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
      this.head.position.y = 1.56;
    }
  }

  syncHeldClues(memory, elapsed) {
    this.handKeycardGroup.visible = memory.keycardObtained;
    this.handScannerGroup.visible = memory.telemetryScanned;
    this.handCipherGroup.visible = memory.securityCodeFound;

    if (memory.securityCodeFound) {
      this.handCipherGroup.rotation.y = elapsed * 3.0;
    }
    if (memory.telemetryScanned) {
      this.handScannerGroup.rotation.y = Math.sin(elapsed * 2.0) * 0.2;
    }
  }

  resetToSpawn() {
    this.setSittingPose(false);
    this.group.position.copy(this.spawnPos);
    this.group.scale.setScalar(1);
    this.facingAngle = Math.PI;
    this.group.rotation.set(0, this.facingAngle, 0);
    this.group.visible = true;
    this.walkTime = 0;
  }

  update(dt, input, colliders, memory, elapsed) {
    let moveX = 0;
    let moveZ = 0;

    if (input.forward) moveZ -= 1;
    if (input.backward) moveZ += 1;
    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;

    const moving = moveX !== 0 || moveZ !== 0;

    if (moving) {
      const len = Math.hypot(moveX, moveZ);
      moveX /= len;
      moveZ /= len;

      const stepX = moveX * this.speed * dt;
      const stepZ = moveZ * this.speed * dt;

      // Axis-separated collision for smooth wall sliding
      this.group.position.x += stepX;
      this._resolveCollisions(colliders);

      this.group.position.z += stepZ;
      this._resolveCollisions(colliders);

      const targetAngle = Math.atan2(moveX, moveZ);
      let diff = targetAngle - this.facingAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facingAngle += diff * Math.min(1, dt * 14);
      this.group.rotation.y = this.facingAngle;

      this.walkTime += dt * 12;
      const swing = Math.sin(this.walkTime) * 0.55;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;

      // Hold arm slightly forward if carrying an item
      const leftRaise = memory.telemetryScanned || memory.securityCodeFound ? -0.55 : 0;
      const rightRaise = memory.keycardObtained ? -0.55 : 0;
      this.leftArm.rotation.x = leftRaise - swing * 0.45;
      this.rightArm.rotation.x = rightRaise + swing * 0.45;
      this.torso.position.y = 0.96 + Math.abs(Math.sin(this.walkTime)) * 0.05;
    } else {
      this.walkTime += dt * 2.5;
      this.leftLeg.rotation.x *= 0.8;
      this.rightLeg.rotation.x *= 0.8;
      const leftTarget = memory.telemetryScanned || memory.securityCodeFound ? -0.6 : 0;
      const rightTarget = memory.keycardObtained ? -0.6 : 0;
      this.leftArm.rotation.x += (leftTarget - this.leftArm.rotation.x) * Math.min(1, dt * 8);
      this.rightArm.rotation.x += (rightTarget - this.rightArm.rotation.x) * Math.min(1, dt * 8);
      this.torso.position.y = 0.96 + Math.sin(this.walkTime) * 0.02;
    }

    this.syncHeldClues(memory, elapsed);
  }

  _resolveCollisions(colliders) {
    const r = this.radius;
    const pos = this.group.position;

    for (let i = 0; i < colliders.length; i++) {
      const box = colliders[i];
      if (box.disabled) continue;

      const closestX = Math.max(box.minX, Math.min(pos.x, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < r * r) {
        if (distSq > 0.000001) {
          const dist = Math.sqrt(distSq);
          const overlap = r - dist;
          pos.x += (dx / dist) * overlap;
          pos.z += (dz / dist) * overlap;
        } else {
          const leftPen = Math.abs(pos.x - box.minX);
          const rightPen = Math.abs(box.maxX - pos.x);
          const topPen = Math.abs(pos.z - box.minZ);
          const bottomPen = Math.abs(box.maxZ - pos.z);
          const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
          if (minPen === leftPen) pos.x = box.minX - r;
          else if (minPen === rightPen) pos.x = box.maxX + r;
          else if (minPen === topPen) pos.z = box.minZ - r;
          else pos.z = box.maxZ + r;
        }
      }
    }
  }
}
