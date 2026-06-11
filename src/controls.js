import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

export class PlayerControls {
  constructor(camera, domElement, onFallOffMap, onJump, isMobile = false) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, domElement);
    this.onFallOffMap = onFallOffMap;
    this.onJump = onJump;
    this.isMobile = isMobile;

    // Movement states
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.canJump = false;
    this.jumpCount = 0;

    // Mobile specific input states
    this.lookTouchId = null;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.lookSensitivity = 0.004;
    this.mobileDirection = new THREE.Vector3();

    // Physics parameters
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.playerHeight = 1.8;
    this.playerRadius = 0.8;
    this.gravity = 35.0;
    this.speedMultiplier = 60.0;
    this.jumpStrength = 14.0;
    this.friction = 8.0;
    this.isBoosted = false;

    this.spawnPoint = new THREE.Vector3(0, this.playerHeight, 0);

    // Set initial position
    this.resetPosition();

    // Bind event handlers
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    if (this.isMobile) {
      window.addEventListener('touchstart', this.onTouchStart, { passive: false });
      window.addEventListener('touchmove', this.onTouchMove, { passive: false });
      window.addEventListener('touchend', this.onTouchEnd, { passive: false });
      window.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
    }
  }

  onTouchStart(event) {
    if (this.lookTouchId !== null) return;
    
    // Find a touch that is on the right half of the screen and not starting on an interactive element
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      if (touch.clientX >= window.innerWidth / 2) {
        const targetTagName = touch.target.tagName;
        if (targetTagName === 'BUTTON' || targetTagName === 'INPUT' || touch.target.closest('#mobile-actions')) {
          continue; // Ignore touches on action buttons
        }
        this.lookTouchId = touch.identifier;
        this.lastTouchX = touch.clientX;
        this.lastTouchY = touch.clientY;
        break;
      }
    }
  }

  onTouchMove(event) {
    if (this.lookTouchId === null) return;

    let lookTouch = null;
    for (let i = 0; i < event.touches.length; i++) {
      if (event.touches[i].identifier === this.lookTouchId) {
        lookTouch = event.touches[i];
        break;
      }
    }

    if (lookTouch) {
      const deltaX = lookTouch.clientX - this.lastTouchX;
      const deltaY = lookTouch.clientY - this.lastTouchY;
      
      this.lastTouchX = lookTouch.clientX;
      this.lastTouchY = lookTouch.clientY;

      const euler = new THREE.Euler(0, 0, 0, 'YXZ');
      euler.setFromQuaternion(this.camera.quaternion);
      euler.y -= deltaX * this.lookSensitivity;
      euler.x -= deltaY * this.lookSensitivity;
      
      const limit = Math.PI / 2 - 0.05;
      euler.x = Math.max(-limit, Math.min(limit, euler.x));
      this.camera.quaternion.setFromEuler(euler);
    }
  }

  onTouchEnd(event) {
    if (this.lookTouchId === null) return;
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      if (event.changedTouches[i].identifier === this.lookTouchId) {
        this.lookTouchId = null;
        break;
      }
    }
  }

  setSpawnPoint(x, y, z) {
    this.spawnPoint.set(x, y, z);
  }

  resetPosition() {
    this.camera.position.copy(this.spawnPoint);
    this.camera.lookAt(this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.z - 10);
    this.velocity.set(0, 0, 0);
    this.jumpCount = 0;
    this.isBoosted = false;
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
    if (!this.isMobile && !this.controls.isLocked) return;

    // Apply friction (damping) - lower damping only when boosted to allow boost momentum to carry player
    const currentFriction = this.isBoosted ? 0.8 : this.friction;
    this.velocity.x -= this.velocity.x * currentFriction * delta;
    this.velocity.z -= this.velocity.z * currentFriction * delta;
    
    // Apply gravity
    this.velocity.y -= this.gravity * delta;

    // Calculate movement direction
    if (this.isMobile) {
      this.direction.copy(this.mobileDirection);
      // mobileDirection is pre-calculated relative to current camera heading
    } else {
      this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
      this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
      this.direction.normalize(); // Ensure diagonal movement isn't faster
    }

    // Apply acceleration
    if (this.isMobile) {
      if (this.direction.lengthSq() > 0.001) {
        this.velocity.z -= this.direction.z * this.speedMultiplier * delta;
        this.velocity.x -= this.direction.x * this.speedMultiplier * delta;
      }
    } else {
      if (this.moveForward || this.moveBackward) {
        this.velocity.z -= this.direction.z * this.speedMultiplier * delta;
      }
      if (this.moveLeft || this.moveRight) {
        this.velocity.x -= this.direction.x * this.speedMultiplier * delta;
      }
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
      if (platform.fadeState === 'collapsed') {
        continue;
      }
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
      this.isBoosted = false;

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

    this.standingPlatform = standingPlatform;

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
    if (this.isMobile) {
      window.removeEventListener('touchstart', this.onTouchStart);
      window.removeEventListener('touchmove', this.onTouchMove);
      window.removeEventListener('touchend', this.onTouchEnd);
      window.removeEventListener('touchcancel', this.onTouchEnd);
    }
    this.controls.dispose();
  }
}
