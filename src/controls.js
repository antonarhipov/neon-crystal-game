import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

export class PlayerControls {
  constructor(camera, domElement, onFallOffMap, onJump) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, domElement);
    this.onFallOffMap = onFallOffMap;
    this.onJump = onJump;

    // Movement states
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.canJump = false;
    this.jumpCount = 0;

    // Physics parameters
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.playerHeight = 1.8;
    this.playerRadius = 0.8;
    this.gravity = 35.0;
    this.speedMultiplier = 60.0;
    this.jumpStrength = 14.0;
    this.friction = 8.0;

    // Set initial position
    this.resetPosition();

    // Bind event handlers
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  resetPosition() {
    this.camera.position.set(0, this.playerHeight, 0);
    this.camera.lookAt(0, this.playerHeight, -10);
    this.velocity.set(0, 0, 0);
    this.jumpCount = 0;
  }

  onKeyDown(event) {
    if (!this.controls.isLocked) return;

    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.moveForward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLeft = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.moveBackward = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveRight = true;
        break;
      case 'Space':
        if (this.canJump || this.jumpCount < 2) {
          const isDoubleJump = this.jumpCount > 0;
          this.velocity.y = isDoubleJump ? this.jumpStrength * 0.95 : this.jumpStrength;
          this.jumpCount++;
          this.canJump = false;
          if (this.onJump) this.onJump(isDoubleJump);
        }
        break;
    }
  }

  onKeyUp(event) {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.moveForward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLeft = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.moveBackward = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveRight = false;
        break;
    }
  }

  update(delta, colliders = [], platforms = []) {
    if (!this.controls.isLocked) return;

    // Apply friction (damping)
    this.velocity.x -= this.velocity.x * this.friction * delta;
    this.velocity.z -= this.velocity.z * this.friction * delta;
    
    // Apply gravity
    this.velocity.y -= this.gravity * delta;

    // Calculate movement direction
    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize(); // Ensure diagonal movement isn't faster

    // Apply acceleration
    if (this.moveForward || this.moveBackward) {
      this.velocity.z -= this.direction.z * this.speedMultiplier * delta;
    }
    if (this.moveLeft || this.moveRight) {
      this.velocity.x -= this.direction.x * this.speedMultiplier * delta;
    }

    // Move player using PointerLockControls (which automatically projects vectors to XZ plane)
    this.controls.moveRight(-this.velocity.x * delta);
    this.controls.moveForward(-this.velocity.z * delta);

    // Apply vertical movement
    this.camera.position.y += this.velocity.y * delta;

    // Multi-height platforms and moving platforms checking
    let grounded = false;
    let groundY = -9999;
    let standingPlatform = null;

    // 1. Check Floor Grid (80x80 area at y = 0)
    const isPlayerOnFloor = Math.abs(this.camera.position.x) <= 40 && Math.abs(this.camera.position.z) <= 40;
    if (isPlayerOnFloor) {
      groundY = 0;
      // Allow landing if falling or very close to surface
      if (this.camera.position.y <= this.playerHeight + 0.1 && this.camera.position.y >= this.playerHeight - 1.2 && this.velocity.y <= 0.01) {
        grounded = true;
      }
    }

    // 2. Check Floating Platforms
    for (const platform of platforms) {
      const pad = 0.2; // Extra bounding box padding
      const inX = this.camera.position.x >= platform.minX - pad && this.camera.position.x <= platform.maxX + pad;
      const inZ = this.camera.position.z >= platform.minZ - pad && this.camera.position.z <= platform.maxZ + pad;

      if (inX && inZ) {
        const targetY = platform.y + this.playerHeight;
        if (this.camera.position.y <= targetY + 0.1 && this.camera.position.y >= targetY - 1.2 && this.velocity.y <= 0.01) {
          // Select highest platform if overlapping
          if (platform.y > groundY) {
            groundY = platform.y;
            grounded = true;
            standingPlatform = platform;
          }
        }
      }
    }

    if (grounded) {
      this.velocity.y = 0;
      this.camera.position.y = groundY + this.playerHeight;
      this.canJump = true;
      this.jumpCount = 0;

      // Sync position with moving platforms
      if (standingPlatform && standingPlatform.displacement) {
        this.camera.position.x += standingPlatform.displacement.x;
        this.camera.position.y += standingPlatform.displacement.y;
        this.camera.position.z += standingPlatform.displacement.z;
      }
    } else {
      // In air - don't force canJump to true, but do not set canJump to false if we still have jumps left
      // Actually, we can let canJump be false, since our space trigger checks `this.canJump || this.jumpCount < 2`
      this.canJump = false;
    }

    // Collision detection with pillars/monoliths
    // Colliders are passed as an array of objects: { position: THREE.Vector3, radius: number }
    for (const collider of colliders) {
      const dx = this.camera.position.x - collider.position.x;
      const dz = this.camera.position.z - collider.position.z;
      const distance2D = Math.sqrt(dx * dx + dz * dz);
      const minDistance = this.playerRadius + collider.radius;

      if (distance2D < minDistance) {
        // Calculate collision normal (direction from collider to player)
        const nx = dx / (distance2D || 1);
        const nz = dz / (distance2D || 1);

        // Push player out of collision
        const overlap = minDistance - distance2D;
        this.camera.position.x += nx * overlap;
        this.camera.position.z += nz * overlap;
      }
    }

    // Abyss check (falling off the edge of the platform)
    if (this.camera.position.y < -15.0) {
      this.resetPosition();
      if (this.onFallOffMap) this.onFallOffMap();
    }
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.controls.dispose();
  }
}
