import './style.css';
import * as THREE from 'three';
import { PlayerControls } from './controls.js';
import { GameWorld } from './world.js';
import { AudioManager } from './audio.js';
import { ParticleSystem } from './particles.js';

class GameApp {
  constructor() {
    this.gameState = 'START'; // START, PLAYING, LEVEL_CLEAR, GAMEOVER, VICTORY
    this.currentLevel = 1;
    this.totalCrystals = 15;
    
    // Scoring and timings
    this.score = 0;
    this.totalScore = 0;
    this.gameDuration = 60.0; // Level 1 timer
    this.timeLeft = this.gameDuration;
    this.highScore = parseInt(localStorage.getItem('neon_crystal_high_score') || '0', 10);

    // Combo system
    this.comboMultiplier = 1;
    this.comboTimer = 0.0;
    this.comboDuration = 3.5;

    // Cooldown timers
    this.laserHitCooldown = 0;
    this.portalCooldown = 0;

    // Weapons and Combat
    this.ammo = 5;
    this.projectiles = [];

    // Components
    this.audio = new AudioManager();
    this.particles = null;
    this.timer = new THREE.Timer();
    this.timer.connect(document);

    // DOM Elements
    this.canvas = document.getElementById('game-canvas');
    this.scoreCountEl = document.getElementById('score-count');
    this.targetCountEl = document.getElementById('target-count');
    this.timerTextEl = document.getElementById('timer-text');
    this.timerFillEl = document.getElementById('timer-fill');
    this.soundBtnEl = document.getElementById('sound-btn');
    
    // Combo DOM elements
    this.comboContainer = document.getElementById('combo-container');
    this.comboText = document.getElementById('combo-text');
    this.comboFill = document.getElementById('combo-fill');
    
    // Screen Overlays
    this.startScreen = document.getElementById('start-screen');
    this.gameoverScreen = document.getElementById('gameover-screen');
    this.victoryScreen = document.getElementById('victory-screen');
    this.levelclearScreen = document.getElementById('levelclear-screen');
    this.levelselectScreen = document.getElementById('levelselect-screen');
    
    // Action Buttons
    this.startBtn = document.getElementById('start-btn');
    this.restartBtn = document.getElementById('restart-btn');
    this.playAgainBtn = document.getElementById('play-again-btn');
    this.nextLevelBtn = document.getElementById('next-level-btn');
    this.levelselectCloseBtn = document.getElementById('levelselect-close-btn');

    this.isLevelSelecting = false;

    // Device detection
    this.isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (this.isMobile) {
      document.body.classList.add('is-mobile');
    }

    // Mobile controls DOM elements
    this.mobileControls = document.getElementById('mobile-controls');
    this.joystickZone = document.getElementById('joystick-zone');
    this.joystickBase = document.getElementById('joystick-base');
    this.joystickHandle = document.getElementById('joystick-handle');
    this.mobileShootBtn = document.getElementById('mobile-shoot-btn');
    this.mobileJumpBtn = document.getElementById('mobile-jump-btn');
    this.mobileGuideBtn = document.getElementById('mobile-guide-btn');
    this.mobileMusicBtn = document.getElementById('mobile-music-btn');
    this.mobileSectorsBtn = document.getElementById('mobile-sectors-btn');

    // Radar Elements
    this.radarCanvas = document.getElementById('radar-canvas');
    this.radarCtx = this.radarCanvas.getContext('2d');

    // Initialize WebGL Scene
    this.initThree();

    // Initialize Game World and Components
    this.world = new GameWorld(this.scene);
    this.world.build();
    
    this.particles = new ParticleSystem(this.scene);
    
    this.initControls();
    this.bindEvents();

    // Load initial Level 1
    this.world.loadLevel(1);
    this.targetCountEl.textContent = this.totalCrystals;

    // Start Rendering
    this.animate();
  }

  // Set up Three.js WebGL rendering pipeline and lighting
  initThree() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      70, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Ambient light (low intensity, purple/blue space glow)
    const ambientLight = new THREE.AmbientLight(0x1a1230, 0.65);
    this.scene.add(ambientLight);

    // Directional light (nebula glow)
    const dirLight = new THREE.DirectionalLight(0x00f0ff, 0.45);
    dirLight.position.set(20, 40, 20);
    this.scene.add(dirLight);

    // Dynamic point lights for neon towers
    const createTowerLight = (x, z, color) => {
      const pLight = new THREE.PointLight(color, 2.0, 22, 1.2);
      pLight.position.set(x, 6, z);
      this.scene.add(pLight);
    };

    createTowerLight(-18, -18, 0x00f0ff);
    createTowerLight(18, -18, 0xff00b4);
    createTowerLight(-18, 18, 0xff00b4);
    createTowerLight(18, 18, 0x00f0ff);
    createTowerLight(0, -25, 0x00f0ff);
  }

  // Handle mission starting state transitions
  startGame() {
    this.startScreen.classList.add('hidden');
    this.gameoverScreen.classList.add('hidden');
    this.victoryScreen.classList.add('hidden');
    this.levelclearScreen.classList.add('hidden');
    
    this.audio.init();
    this.audio.resume();
    this.audio.startAmbientDrone();
    
    if (this.gameState === 'START' || this.gameState === 'GAMEOVER' || this.gameState === 'VICTORY' || this.gameState === 'LEVEL_CLEAR') {
      this.gameState = 'PLAYING';
    }
  }

  // Set up custom movement controls
  initControls() {
    this.controls = new PlayerControls(
      this.camera, 
      this.canvas,
      // Fall off map callback
      () => {
        this.audio.playRespawnSound();
        this.timeLeft = Math.max(0, this.timeLeft - 10.0);
        this.showPenaltySplash('-10s FALLOUT PENALTY');
      },
      // Jump callback
      (isDoubleJump) => {
        if (isDoubleJump) {
          this.audio.playDoubleJumpSound();
          const feetPos = this.camera.position.clone();
          feetPos.y -= 1.6;
          this.particles.spawn(feetPos, 0x00f0ff, 20);
        } else {
          this.audio.playJumpSound();
        }
      },
      this.isMobile
    );
  }

  // Bind HUD buttons and Pointer Lock interactions
  bindEvents() {
    // Start button
    this.startBtn.addEventListener('click', () => {
      if (this.isMobile) {
        this.startGame();
      } else {
        this.controls.controls.lock();
      }
    });

    // Restart button
    this.restartBtn.addEventListener('click', () => {
      this.resetGame();
      if (this.isMobile) {
        this.startGame();
      } else {
        this.controls.controls.lock();
      }
    });

    // Play again button
    this.playAgainBtn.addEventListener('click', () => {
      this.resetGame();
      if (this.isMobile) {
        this.startGame();
      } else {
        this.controls.controls.lock();
      }
    });

    // Next Level transition button
    this.nextLevelBtn.addEventListener('click', () => {
      this.proceedToNextLevel();
    });

    // Sound toggle
    this.soundBtnEl.addEventListener('click', () => {
      const isMuted = this.audio.toggleMute();
      this.soundBtnEl.textContent = isMuted ? '🔇' : '🔊';
    });

    // Handle PointerLock events
    this.controls.controls.addEventListener('lock', () => {
      this.startGame();
    });

    this.controls.controls.addEventListener('unlock', () => {
      if (this.isLevelSelecting || this.isMobile) {
        return;
      }
      if (this.gameState === 'PLAYING') {
        this.startBtn.textContent = 'Resume Mission';
        this.startScreen.classList.remove('hidden');
      }
    });

    // Toggle holographic path guide using 'H' key / Toggle Sector select using 'L' key
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyH' && this.gameState === 'PLAYING') {
        const nextVisible = !this.world.guidesVisible;
        this.world.toggleNavigationGuides(nextVisible);
        this.showPenaltySplash(nextVisible ? 'HOLOGRAPHIC GUIDES ON' : 'HOLOGRAPHIC GUIDES OFF');
        this.audio.playGuideToggleSound();
      }
      if (e.code === 'KeyL') {
        if (this.gameState === 'PLAYING' || this.gameState === 'START') {
          this.isLevelSelecting = true;
          this.controls.controls.unlock();
          this.startScreen.classList.add('hidden');
          this.levelselectScreen.classList.remove('hidden');
        } else if (this.isLevelSelecting) {
          this.closeLevelSelect();
        }
      }
      if (e.code === 'KeyM') {
        const isMuted = this.audio.toggleMusic();
        this.showScoreSplash(isMuted ? 'BACKGROUND MUSIC MUTED' : 'BACKGROUND MUSIC SYNCED');
      }
    });

    // Fire weapon on left mouse click when cursor is locked and game is playing
    window.addEventListener('mousedown', (e) => {
      if (this.gameState === 'PLAYING' && e.button === 0 && !this.isLevelSelecting && this.controls.controls.isLocked) {
        this.fireWeapon();
      }
    });

    // Sector select actions
    this.levelselectCloseBtn.addEventListener('click', () => {
      this.closeLevelSelect();
    });

    const selectButtons = document.querySelectorAll('.level-select-btn');
    selectButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const level = parseInt(btn.getAttribute('data-level'));
        this.loadSelectedLevel(level);
      });
    });

    // Mobile touch controls setup
    if (this.isMobile) {
      // Joystick Touch ID tracker
      this.joystickTouchId = null;
      this.joystickStartX = 0;
      this.joystickStartY = 0;

      // Joystick touchstart
      this.joystickZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.gameState !== 'PLAYING' || this.joystickTouchId !== null) return;

        const touch = e.changedTouches[0];
        this.joystickTouchId = touch.identifier;
        this.joystickStartX = touch.clientX;
        this.joystickStartY = touch.clientY;

        this.joystickBase.style.left = `${this.joystickStartX}px`;
        this.joystickBase.style.top = `${this.joystickStartY}px`;
        this.joystickBase.style.display = 'block';
        this.joystickHandle.style.transform = 'translate(-50%, -50%)';
      }, { passive: false });

      // Joystick touchmove
      this.joystickZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (this.gameState !== 'PLAYING' || this.joystickTouchId === null) return;

        let touch = null;
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === this.joystickTouchId) {
            touch = e.touches[i];
            break;
          }
        }

        if (touch) {
          const dx = touch.clientX - this.joystickStartX;
          const dy = touch.clientY - this.joystickStartY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxRadius = 50;

          const angle = Math.atan2(dy, dx);
          const limitDist = Math.min(dist, maxRadius);
          const moveX = Math.cos(angle) * limitDist;
          const moveY = Math.sin(angle) * limitDist;

          this.joystickHandle.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;

          // Calculate normalized coordinates
          const normX = moveX / maxRadius;
          const normY = moveY / maxRadius;

          // Map to PlayerControls movement vector (x = lateral, z = longitudinal)
          // Positive z moves player forward, positive x moves player right
          this.controls.mobileDirection.x = normX;
          this.controls.mobileDirection.z = -normY;
        }
      }, { passive: false });

      // Joystick touchend
      const handleJoystickEnd = (e) => {
        if (this.joystickTouchId === null) return;

        let touchEnded = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.joystickTouchId) {
            touchEnded = true;
            break;
          }
        }

        if (touchEnded) {
          e.preventDefault();
          this.joystickTouchId = null;
          this.joystickBase.style.display = 'none';
          this.controls.mobileDirection.set(0, 0, 0);
        }
      };

      this.joystickZone.addEventListener('touchend', handleJoystickEnd, { passive: false });
      this.joystickZone.addEventListener('touchcancel', handleJoystickEnd, { passive: false });

      // Mobile action buttons
      this.mobileJumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.gameState === 'PLAYING') {
          if (this.controls.canJump || this.controls.jumpCount < 2) {
            const isDoubleJump = this.controls.jumpCount > 0;
            this.controls.velocity.y = isDoubleJump ? this.controls.jumpStrength * 0.95 : this.controls.jumpStrength;
            this.controls.jumpCount++;
            this.controls.canJump = false;
            if (this.controls.onJump) this.controls.onJump(isDoubleJump);
          }
        }
      }, { passive: false });

      this.mobileShootBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.gameState === 'PLAYING' && !this.isLevelSelecting) {
          this.fireWeapon();
        }
      }, { passive: false });

      // Mobile top menu buttons
      this.mobileGuideBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.gameState === 'PLAYING') {
          const nextVisible = !this.world.guidesVisible;
          this.world.toggleNavigationGuides(nextVisible);
          this.showPenaltySplash(nextVisible ? 'HOLOGRAPHIC GUIDES ON' : 'HOLOGRAPHIC GUIDES OFF');
          this.audio.playGuideToggleSound();
        }
      }, { passive: false });

      this.mobileMusicBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const isMuted = this.audio.toggleMusic();
        this.showScoreSplash(isMuted ? 'BACKGROUND MUSIC MUTED' : 'BACKGROUND MUSIC SYNCED');
      }, { passive: false });

      this.mobileSectorsBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.gameState === 'PLAYING' || this.gameState === 'START') {
          this.isLevelSelecting = true;
          this.startScreen.classList.add('hidden');
          this.levelselectScreen.classList.remove('hidden');
        }
      }, { passive: false });
    }

    // Handle resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // Reset all game variables back to Level 1 spawn state
  resetGame() {
    this.score = 0;
    this.totalScore = 0;
    this.currentLevel = 1;
    this.gameDuration = 60.0;
    this.timeLeft = this.gameDuration;
    this.gameState = 'PLAYING';
    
    this.controls.setSpawnPoint(0, 1.8, 0);
    this.world.loadLevel(1);
    this.controls.resetPosition();
    this.controls.gravity = 35.0;
    const vignette = document.getElementById('gravity-vignette');
    if (vignette) vignette.classList.remove('active');
    this.playerInGravityFieldLastFrame = false;

    // Reset HUD DOM elements
    this.scoreCountEl.textContent = '0';
    this.targetCountEl.textContent = '15';
    this.timerTextEl.textContent = `${this.gameDuration.toFixed(1)}s`;
    this.timerFillEl.style.width = '100%';
    this.timerFillEl.classList.remove('warning');
    document.getElementById('level-display').textContent = '1';

    this.timer.reset();
    this.resetCombo();

    // Reset weapons and projectiles
    this.ammo = 5;
    const ammoEl = document.getElementById('ammo-count');
    if (ammoEl) ammoEl.textContent = '5';
    this.projectiles.forEach(p => this.scene.remove(p.mesh));
    this.projectiles = [];
  }

  // Reset combo tracking
  resetCombo() {
    this.comboMultiplier = 1;
    this.comboTimer = 0.0;
    this.comboContainer.classList.add('hidden');
    this.comboContainer.classList.remove('combo-active');
  }

  fireWeapon() {
    if (this.ammo <= 0) {
      this.audio.playEmptyClipSound();
      this.showPenaltySplash('NO AMMUNITION SHELLS');
      return;
    }

    this.ammo--;
    const ammoEl = document.getElementById('ammo-count');
    if (ammoEl) ammoEl.textContent = this.ammo;
    this.audio.playLaserShootSound();

    // Trigger crosshair firing recoil visual scale
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
      crosshair.classList.add('active');
      setTimeout(() => crosshair.classList.remove('active'), 80);
    }

    // Fire direction from camera world orientation
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    // Position starting slightly forward and lower
    const spawnPos = this.camera.position.clone().addScaledVector(dir, 0.5);
    spawnPos.y -= 0.15;

    // Glowing cyan/yellow projectile mesh
    const geo = new THREE.SphereGeometry(0.1, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(spawnPos);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      direction: dir,
      speed: 48.0,
      timeLeft: 1.4
    });

    // Fire sparks particle burst
    this.particles.spawn(spawnPos, 0xffff00, 4);
  }

  collectAmmoPack(ammoPack) {
    ammoPack.isActive = false;
    ammoPack.mesh.visible = false;
    ammoPack.respawnTimer = 10.0; // 10 seconds respawn timer
    
    this.ammo += 3;
    const ammoEl = document.getElementById('ammo-count');
    if (ammoEl) ammoEl.textContent = this.ammo;
    this.audio.playAmmoCollectSound();
    
    this.showScoreSplash('+3 AMMO SECURED');
    this.particles.spawn(ammoPack.mesh.position, 0xffff00, 15);
  }

  damageGuard(guard, index, fireDirection) {
    // Robust defensive fallback for health properties
    if (typeof guard.maxHealth !== 'number' || isNaN(guard.maxHealth)) {
      guard.maxHealth = 2;
    }
    if (typeof guard.health !== 'number' || isNaN(guard.health)) {
      guard.health = guard.maxHealth;
    }

    if (guard.isDecoy) {
      guard.health = 0; // Decoys disintegrate in 1 hit
    } else {
      guard.health--;
    }
    console.log(`[Combat] Drone hit! Health: ${guard.health}/${guard.maxHealth}`);
    
    // Impact pushback & visual squashing juice
    const pushDir = fireDirection.clone();
    pushDir.y = 0;
    pushDir.normalize();
    guard.mesh.position.addScaledVector(pushDir, 1.6);
    
    // Set squashed scale and bright glowing flash
    guard.mesh.scale.set(1.4, 0.6, 1.4);
    guard.coreMesh.material.emissiveIntensity = 6.0;

    // Spawn damage sparks
    this.particles.spawn(guard.mesh.position, guard.isDecoy ? 0x00f0ff : 0xffaa00, 10);

    if (guard.health <= 0) {
      if (guard.isDecoy) {
        this.audio.playGlitchDecoySound();
        this.particles.spawn(guard.mesh.position, 0x00f0ff, 25);
        this.showScoreSplash('DECOY SENTINEL VAPORIZED');
      } else {
        this.audio.playGuardExplosionSound();
        this.particles.spawn(guard.mesh.position, 0xff3300, 24);
        
        this.totalScore += 500;
        this.showScoreSplash('SENTINEL DESTROYED +500');
      }

      // Update billboard health bar graphic to 0%
      guard.healthBarFg.scale.x = 0;
      if (guard.healthTextCanvas && guard.healthTextCtx && guard.healthTextTexture) {
        const ctx = guard.healthTextCtx;
        ctx.clearRect(0, 0, 64, 32);
        ctx.font = 'bold 20px "Courier New", monospace';
        ctx.fillStyle = '#ff3300';
        ctx.fillText('0%', 32, 16);
        guard.healthTextTexture.needsUpdate = true;
      }

      // Mark for evaporation animation
      guard.isEvaporating = true;
      guard.evaporateTimer = 0.65;
    } else {
      this.audio.playGuardDamageSound();
      
      // Update billboard health bar graphic
      const ratio = Math.max(0, guard.health / guard.maxHealth);
      guard.healthBarFg.scale.x = ratio;
      guard.healthBarFg.position.x = - (1.0 - ratio) * 0.6; // Shift pivot

      if (ratio < 0.35) {
        guard.healthBarFg.material.color.setHex(0xff3300); // Red
      } else if (ratio < 0.65) {
        guard.healthBarFg.material.color.setHex(0xffaa00); // Orange
      }

      // Update 3D health percentage canvas text texture
      if (guard.healthTextCanvas && guard.healthTextCtx && guard.healthTextTexture) {
        const percent = Math.round(ratio * 100);
        const ctx = guard.healthTextCtx;
        ctx.clearRect(0, 0, 64, 32);
        ctx.font = 'bold 20px "Courier New", monospace';
        ctx.fillStyle = ratio < 0.35 ? '#ff3300' : (ratio < 0.65 ? '#ffaa00' : '#ffffff');
        ctx.fillText(percent + '%', 32, 16);
        guard.healthTextTexture.needsUpdate = true;
      }
    }
  }

  // Update combo decay bar
  updateCombo(delta) {
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.resetCombo();
      } else {
        const ratio = this.comboTimer / this.comboDuration;
        this.comboFill.style.width = `${ratio * 100}%`;
      }
    }
  }

  // Handle game-over state
  triggerGameOver() {
    this.gameState = 'GAMEOVER';
    this.controls.controls.unlock();
    this.audio.stopAmbientDrone();
    this.audio.playGameOverSound();

    // Display Stats
    document.getElementById('go-score').textContent = `${Math.floor(this.totalScore)} pts`;
    document.getElementById('go-high-score').textContent = this.highScore;

    this.gameoverScreen.classList.remove('hidden');
  }

  // Handle Level Completion Screen
  triggerLevelClear() {
    this.gameState = 'LEVEL_CLEAR';
    this.controls.controls.unlock();
    this.audio.stopAmbientDrone();
    this.audio.playLevelClearSound();

    // Calculate score points for this level
    const timeBonus = Math.floor(this.timeLeft * 10);
    const sectorScore = (this.totalCrystals * 100) + timeBonus;
    this.totalScore += timeBonus;

    // Display Stats
    document.getElementById('lc-crystals').textContent = `${this.totalCrystals} / ${this.totalCrystals}`;
    document.getElementById('lc-time-bonus').textContent = `+${timeBonus}`;
    document.getElementById('lc-sector-score').textContent = `+${sectorScore}`;
    document.getElementById('lc-total-score').textContent = Math.floor(this.totalScore);

    // Dynamic titles
    document.getElementById('lc-title').textContent = `Sector ${this.currentLevel} Synchronized`;
    
    if (this.currentLevel < 9) {
      this.nextLevelBtn.textContent = 'Enter Next Sector';
    } else {
      this.nextLevelBtn.textContent = 'Finalize Core Grid';
    }

    this.levelclearScreen.classList.remove('hidden');
  }

  // Next level loading
  proceedToNextLevel() {
    this.levelclearScreen.classList.add('hidden');
    
    if (this.currentLevel === 9) {
      this.triggerVictory();
      return;
    }

    this.currentLevel++;
    document.getElementById('level-display').textContent = this.currentLevel;

    // Set level configurations
    if (this.currentLevel === 2) {
      this.totalCrystals = 14;
      this.gameDuration = 75.0;
    } else if (this.currentLevel === 3) {
      this.totalCrystals = 15;
      this.gameDuration = 90.0;
    } else if (this.currentLevel === 4) {
      this.totalCrystals = 15;
      this.gameDuration = 85.0;
    } else if (this.currentLevel === 5) {
      this.totalCrystals = 14;
      this.gameDuration = 95.0;
    } else if (this.currentLevel === 6) {
      this.totalCrystals = 15;
      this.gameDuration = 110.0;
    } else if (this.currentLevel === 7) {
      this.totalCrystals = 15;
      this.gameDuration = 120.0;
    } else if (this.currentLevel === 8) {
      this.totalCrystals = 15;
      this.gameDuration = 130.0;
    } else if (this.currentLevel === 9) {
      this.totalCrystals = 15;
      this.gameDuration = 145.0;
    }

    this.score = 0;
    this.timeLeft = this.gameDuration;
    this.gameState = 'PLAYING';
    
    // Reset weapons and projectiles
    this.ammo = 5;
    const ammoEl = document.getElementById('ammo-count');
    if (ammoEl) ammoEl.textContent = '5';
    this.projectiles.forEach(p => this.scene.remove(p.mesh));
    this.projectiles = [];
    
    // Configure level-specific spawn points
    let spawnX = 0, spawnY = 1.8, spawnZ = 0;
    if (this.currentLevel === 4) {
      spawnX = 0; spawnY = 5.8; spawnZ = 26;
    } else if (this.currentLevel === 6) {
      spawnX = 0; spawnY = 4.8; spawnZ = 26;
    } else if (this.currentLevel === 7) {
      spawnX = 0; spawnY = 5.8; spawnZ = 26;
    } else if (this.currentLevel === 8) {
      spawnX = 0; spawnY = 4.8; spawnZ = 26;
    } else if (this.currentLevel === 9) {
      spawnX = 0; spawnY = 5.8; spawnZ = 30;
    }
    this.controls.setSpawnPoint(spawnX, spawnY, spawnZ);

    // Load next level assets
    this.world.loadLevel(this.currentLevel);
    this.controls.resetPosition();

    // Reset HUD
    this.scoreCountEl.textContent = '0';
    this.targetCountEl.textContent = this.totalCrystals;
    this.timerTextEl.textContent = `${this.gameDuration.toFixed(1)}s`;
    this.timerFillEl.style.width = '100%';
    this.timerFillEl.classList.remove('warning');

    this.timer.reset();
    this.resetCombo();
    
    // Relock mouse to resume playing
    this.controls.controls.lock();
  }

  closeLevelSelect() {
    this.levelselectScreen.classList.add('hidden');
    this.isLevelSelecting = false;
    if (this.gameState === 'PLAYING') {
      this.controls.controls.lock();
    } else {
      this.startScreen.classList.remove('hidden');
    }
  }

  loadSelectedLevel(level) {
    this.levelselectScreen.classList.add('hidden');
    this.isLevelSelecting = false;
    
    // Set level configurations
    this.currentLevel = level;
    this.score = 0;
    this.scoreCountEl.textContent = '0';

    // Reset weapons and projectiles
    this.ammo = 5;
    const ammoEl = document.getElementById('ammo-count');
    if (ammoEl) ammoEl.textContent = '5';
    this.projectiles.forEach(p => this.scene.remove(p.mesh));
    this.projectiles = [];
    
    if (level === 1) {
      this.totalCrystals = 15;
      this.gameDuration = 60.0;
    } else if (level === 2) {
      this.totalCrystals = 14;
      this.gameDuration = 75.0;
    } else if (level === 3) {
      this.totalCrystals = 15;
      this.gameDuration = 90.0;
    } else if (level === 4) {
      this.totalCrystals = 15;
      this.gameDuration = 85.0;
    } else if (level === 5) {
      this.totalCrystals = 14;
      this.gameDuration = 95.0;
    } else if (level === 6) {
      this.totalCrystals = 15;
      this.gameDuration = 110.0;
    } else if (level === 7) {
      this.totalCrystals = 15;
      this.gameDuration = 120.0;
    } else if (level === 8) {
      this.totalCrystals = 15;
      this.gameDuration = 130.0;
    } else if (level === 9) {
      this.totalCrystals = 15;
      this.gameDuration = 145.0;
    }
    
    this.targetCountEl.textContent = this.totalCrystals;
    document.getElementById('level-display').textContent = this.currentLevel;
    
    // Configure level-specific spawn points
    let spawnX = 0, spawnY = 1.8, spawnZ = 0;
    if (level === 4) {
      spawnX = 0; spawnY = 5.8; spawnZ = 26;
    } else if (level === 6) {
      spawnX = 0; spawnY = 4.8; spawnZ = 26;
    } else if (level === 7) {
      spawnX = 0; spawnY = 5.8; spawnZ = 26;
    } else if (level === 8) {
      spawnX = 0; spawnY = 4.8; spawnZ = 26;
    } else if (level === 9) {
      spawnX = 0; spawnY = 5.8; spawnZ = 30;
    }
    this.controls.setSpawnPoint(spawnX, spawnY, spawnZ);

    this.gameState = 'PLAYING';
    this.world.loadLevel(level);
    this.controls.resetPosition();
    this.timeLeft = this.gameDuration;
    this.timerTextEl.textContent = `${this.timeLeft.toFixed(1)}s`;
    this.timerFillEl.style.width = '100%';
    this.timerFillEl.classList.remove('warning');
    
    this.audio.init();
    this.audio.resume();
    this.audio.startAmbientDrone();
    
    this.controls.controls.lock();
    this.showPenaltySplash(`SECTOR ${level} LOADED`);
    
    this.audio.playGuideToggleSound();
  }

  // Handle victory state transitions
  triggerVictory() {
    this.gameState = 'VICTORY';
    this.controls.controls.unlock();
    this.audio.stopAmbientDrone();
    this.audio.playVictorySound();

    const finalScore = Math.floor(this.totalScore);

    // Save high score
    if (finalScore > this.highScore) {
      this.highScore = finalScore;
      localStorage.setItem('neon_crystal_high_score', finalScore.toString());
    }

    // Display Stats
    document.getElementById('vic-time').textContent = 'GRID SECURED';
    document.getElementById('vic-bonus').textContent = `3 / 3 Sectors`;
    document.getElementById('vic-score').textContent = finalScore;

    this.victoryScreen.classList.remove('hidden');
  }

  // Collect event trigger
  collectCrystal(crystal) {
    this.world.removeCrystal(crystal.id);
    
    this.audio.playCollectSound();
    this.particles.spawnExplosion(crystal.mesh.position, 0xff00b4);

    // Calculate score points using combo multiplier
    if (this.comboTimer > 0) {
      this.comboMultiplier++;
    } else {
      this.comboMultiplier = 1;
    }
    
    this.comboTimer = this.comboDuration;

    // Display combo HUD feedback
    if (this.comboMultiplier > 1) {
      this.comboText.textContent = `COMBO x${this.comboMultiplier}`;
      this.comboContainer.classList.remove('hidden');
      this.comboContainer.classList.add('combo-active');
      this.showScoreSplash(`+${100 * this.comboMultiplier} (COMBO x${this.comboMultiplier})`);
    } else {
      this.comboContainer.classList.add('hidden');
      this.comboContainer.classList.remove('combo-active');
      this.showScoreSplash('+100');
    }

    // Update Score
    const points = 100 * this.comboMultiplier;
    this.score++;
    this.scoreCountEl.textContent = this.score;

    this.totalScore += points;

    // Check level clear
    console.log(`[Crystal Collected] score: ${this.score}, target: ${this.totalCrystals}, currentLevel: ${this.currentLevel}`);
    if (this.score >= this.totalCrystals) {
      this.triggerLevelClear();
    }
  }

  // UI score splash popup
  showScoreSplash(text) {
    const splash = document.createElement('div');
    splash.className = 'pickup-splash';
    splash.textContent = text;
    splash.style.left = '50%';
    splash.style.top = '40%';
    document.body.appendChild(splash);

    setTimeout(() => {
      splash.remove();
    }, 850);
  }

  // UI hazard warning popup
  showPenaltySplash(text) {
    const splash = document.createElement('div');
    splash.className = 'penalty-splash';
    splash.textContent = text;
    splash.style.left = '50%';
    splash.style.top = '35%';
    splash.style.color = '#ff0055';
    splash.style.textShadow = '0 0 10px rgba(255, 0, 85, 0.6)';
    document.body.appendChild(splash);

    setTimeout(() => {
      splash.remove();
    }, 850);
  }

  // Distance helper: Point to line-segment
  distancePointToSegment(p, a, b) {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ap = new THREE.Vector3().subVectors(p, a);
    
    let t = ap.dot(ab) / ab.lengthSq();
    t = Math.max(0, Math.min(1, t)); // Clamp to bounds of segment
    
    const closest = new THREE.Vector3().addVectors(a, ab.multiplyScalar(t));
    return p.distanceTo(closest);
  }

  // Angle difference helper (keeps it in range -PI to PI)
  angleDifference(a, b) {
    return Math.atan2(Math.sin(a - b), Math.cos(a - b));
  }

  // Draw HUD radar display representing crystals, player, and enemy guards
  drawRadar(time) {
    const ctx = this.radarCtx;
    const w = this.radarCanvas.width;
    const h = this.radarCanvas.height;
    const center = w / 2;

    ctx.clearRect(0, 0, w, h);

    // 1. Radar Circles
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center, center, center - 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(center, center, center * 0.66, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(center, center, center * 0.33, 0, Math.PI * 2);
    ctx.stroke();

    // Cross lines
    ctx.beginPath();
    ctx.moveTo(center, 0);
    ctx.lineTo(center, h);
    ctx.moveTo(0, center);
    ctx.lineTo(w, center);
    ctx.stroke();

    // 2. Scan Sweep Line Animation
    const sweepAngle = time * 1.8;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(
      center + Math.cos(sweepAngle) * (center - 2),
      center + Math.sin(sweepAngle) * (center - 2)
    );
    ctx.stroke();

    // 3. Draw crystals relative to player position and look rotation
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    const playerAngle = Math.atan2(camDir.x, camDir.z);

    const crystals = this.world.getCrystals();
    const radarRange = 45;
    const radarRadiusPixel = center - 5;

    crystals.forEach((c) => {
      const rx = c.basePosition.x - this.camera.position.x;
      const rz = c.basePosition.z - this.camera.position.z;
      const distance = Math.sqrt(rx * rx + rz * rz);

      const rotatedX = rx * Math.cos(-playerAngle) - rz * Math.sin(-playerAngle);
      const rotatedZ = rx * Math.sin(-playerAngle) + rz * Math.cos(-playerAngle);

      if (distance < radarRange) {
        const scale = radarRadiusPixel / radarRange;
        const px = center + rotatedX * scale;
        const py = center + rotatedZ * scale;

        ctx.fillStyle = '#ff00b4';
        ctx.shadowColor = '#ff00b4';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(px, py, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // 4. Draw AI Patrol Guards (represented as glowing red-orange diamonds)
    const guards = this.world.getGuards();
    guards.forEach((g) => {
      const rx = g.mesh.position.x - this.camera.position.x;
      const rz = g.mesh.position.z - this.camera.position.z;
      const distance = Math.sqrt(rx * rx + rz * rz);

      const rotatedX = rx * Math.cos(-playerAngle) - rz * Math.sin(-playerAngle);
      const rotatedZ = rx * Math.sin(-playerAngle) + rz * Math.cos(-playerAngle);

      if (distance < radarRange) {
        const scale = radarRadiusPixel / radarRange;
        const px = center + rotatedX * scale;
        const py = center + rotatedZ * scale;

        ctx.fillStyle = g.isAlert ? '#ffbb00' : '#ff2200';
        ctx.shadowColor = g.isAlert ? '#ffbb00' : '#ff2200';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(px, py - 4.5);
        ctx.lineTo(px + 4.5, py);
        ctx.lineTo(px, py + 4.5);
        ctx.lineTo(px - 4.5, py);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // 5. Draw Player Triangle in Center
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(center, center - 6);
    ctx.lineTo(center - 5, center + 4);
    ctx.lineTo(center + 5, center + 4);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Core update animation loop
  animate(timestamp) {
    requestAnimationFrame((t) => this.animate(t));

    this.timer.update(timestamp || performance.now());
    const delta = Math.min(this.timer.getDelta(), 0.1); // Cap delta to avoid physics explosions on lag spikes
    const time = this.timer.getElapsed();

    if (this.gameState === 'PLAYING') {
      // Update timer countdown
      this.timeLeft = Math.max(0, this.timeLeft - delta);
      this.timerTextEl.textContent = `${this.timeLeft.toFixed(1)}s`;
      
      const ratio = this.timeLeft / this.gameDuration;
      this.timerFillEl.style.width = `${ratio * 100}%`;

      if (this.timeLeft <= 15.0) {
        this.timerFillEl.classList.add('warning');
      } else {
        this.timerFillEl.classList.remove('warning');
      }

      if (this.timeLeft <= 0) {
        this.triggerGameOver();
      }

      // Update player movement (with colliders and floating/moving platforms list)
      this.controls.update(delta, this.world.getColliders(), this.world.getPlatforms());

      // Update combo decay bar
      this.updateCombo(delta);

      // Check collision: Player camera to crystals
      const crystals = this.world.getCrystals();
      const playerPos = this.camera.position;
      const collectThreshold = 1.6;

      for (let i = crystals.length - 1; i >= 0; i--) {
        const c = crystals[i];
        const dist = playerPos.distanceTo(c.mesh.position);
        if (dist < collectThreshold) {
          this.collectCrystal(c);
        }
      }

      // Check collision: Player camera to ammo packs & update respawn timers
      const ammoPacks = this.world.getAmmoPacks();
      for (let i = ammoPacks.length - 1; i >= 0; i--) {
        const a = ammoPacks[i];
        
        // Handle respawning if inactive
        if (a.isActive === false) {
          a.respawnTimer -= delta;
          if (a.respawnTimer <= 0) {
            a.isActive = true;
            a.mesh.visible = true;
            this.particles.spawn(a.basePosition, 0xffff00, 15);
            this.audio.playAmmoCollectSound();
          }
          continue;
        }

        const dist = playerPos.distanceTo(a.mesh.position);
        if (dist < collectThreshold) {
          this.collectAmmoPack(a);
        }
      }

      // Update weapon projectiles and collision checks
      const guards = this.world.getGuards();
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const proj = this.projectiles[i];
        proj.timeLeft -= delta;
        proj.mesh.position.addScaledVector(proj.direction, proj.speed * delta);

        let hit = false;
        
        // 1. Check collision against guards
        for (let j = guards.length - 1; j >= 0; j--) {
          const guard = guards[j];
          if (guard.isEvaporating) continue; // Skip evaporating guards
          const dist = proj.mesh.position.distanceTo(guard.mesh.position);
          if (dist < 1.8) {
            this.damageGuard(guard, j, proj.direction);
            hit = true;
            break;
          }
        }

        // 2. Check collision against interactive switches (Sector 7 Switches)
        if (!hit) {
          const switches = this.world.getSwitches();
          for (let j = switches.length - 1; j >= 0; j--) {
            const sw = switches[j];
            if (sw.isActive) continue;
            // Switch target position is the floating core at pedestal height
            const swPos = sw.mesh.position.clone();
            swPos.y += 0.95;
            const dist = proj.mesh.position.distanceTo(swPos);
            if (dist < 1.5) {
              sw.isActive = true;
              sw.switchMesh.material.color.setHex(0x00ff00); // Set to green
              sw.switchMesh.material.emissive.setHex(0x00ff00);
              this.audio.playAmmoCollectSound(); // Play chime beep sound
              
              // Toggle matching phase platforms
              const platforms = this.world.getPlatforms();
              platforms.forEach(p => {
                if (p.isPhasePlatform && p.phaseId === sw.targetId) {
                  p.isActive = true;
                  p.mesh.visible = true;
                  if (p.edgeLines && p.edgeLines.material) {
                    p.edgeLines.material.color.setHex(p.originalColor);
                  }
                  // restore collision parameters
                  p.minX = p.mesh.position.x - p.width / 2;
                  p.maxX = p.mesh.position.x + p.width / 2;
                  p.minZ = p.mesh.position.z - p.depth / 2;
                  p.maxZ = p.mesh.position.z + p.depth / 2;
                  this.particles.spawn(p.mesh.position, p.originalColor, 20);
                }
              });
              hit = true;
              break;
            }
          }
        }

        // 3. Check collision against destructible barriers (Sector 8 Barriers)
        if (!hit) {
          const barriers = this.world.getBarriers();
          for (let j = barriers.length - 1; j >= 0; j--) {
            const b = barriers[j];
            const px = proj.mesh.position.x;
            const py = proj.mesh.position.y;
            const pz = proj.mesh.position.z;
            
            if (px >= b.minX - 0.25 && px <= b.maxX + 0.25 &&
                pz >= b.minZ - 0.25 && pz <= b.maxZ + 0.25 &&
                py >= b.minY - 0.25 && py <= b.maxY + 0.25) {
              
              b.health--;
              this.particles.spawn(proj.mesh.position, 0xff00ff, 15);
              this.audio.playGuardDamageSound();

              if (b.health <= 0) {
                // Shatter barrier
                this.audio.playBarrierBreakSound();
                this.particles.spawn(b.mesh.position, 0xff00ff, 35);
                this.scene.remove(b.mesh);
                barriers.splice(j, 1);
              } else {
                b.mesh.material.opacity = 0.8;
                setTimeout(() => { b.mesh.material.opacity = 0.35; }, 100);
              }
              hit = true;
              break;
            }
          }
        }

        // 4. Check collision against Boss Homing Missiles (Sector 9)
        if (!hit && this.world.getBossOverseer()) {
          const boss = this.world.getBossOverseer();
          for (let k = boss.projectiles.length - 1; k >= 0; k--) {
            const missile = boss.projectiles[k];
            const dist = proj.mesh.position.distanceTo(missile.mesh.position);
            if (dist < 1.4) {
              this.particles.spawn(missile.mesh.position, 0xff0066, 15);
              this.audio.playGuardExplosionSound();
              this.scene.remove(missile.mesh);
              boss.projectiles.splice(k, 1);
              
              hit = true;
              this.showScoreSplash('HYPER-MISSILE INTERCEPTED');
              break;
            }
          }
        }

        // 5. Check collision against Boss Overseer (Sector 9 Boss)
        if (!hit && this.world.getBossOverseer()) {
          const boss = this.world.getBossOverseer();
          const dist = proj.mesh.position.distanceTo(boss.mesh.position);
          if (dist < 3.8) {
            // Check rotation segment to see if shield blocks or passes to core
            const dx = proj.mesh.position.x - boss.mesh.position.x;
            const dz = proj.mesh.position.z - boss.mesh.position.z;
            const localAngle = Math.atan2(dz, dx) - boss.shieldMesh.rotation.y;
            const normAngle = ((localAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

            const halfShieldWidth = Math.PI * 0.25; // Shield size segments
            const hitsShield1 = normAngle <= halfShieldWidth || normAngle >= Math.PI * 2 - halfShieldWidth;
            const hitsShield2 = Math.abs(normAngle - Math.PI) <= halfShieldWidth;

            if ((hitsShield1 || hitsShield2) && dist > 2.0) {
              // Hit shield! Deflect shot
              this.particles.spawn(proj.mesh.position, 0x00f0ff, 8);
              this.audio.playLaserHitSound();
            } else {
              // Pass shield! Damage boss core
              boss.health--;
              boss.damageIntensity = 1.0;
              this.particles.spawn(proj.mesh.position, 0xff0066, 20);

              if (boss.health <= 0) {
                this.audio.playGuardExplosionSound();
                this.particles.spawn(boss.mesh.position, 0xff0066, 60);
                this.showScoreSplash('NEXUS OVERSEER ELIMINATED +2500');
                this.totalScore += 2500;

                // Chain explosions
                let delay = 0;
                for (let k = 0; k < 6; k++) {
                  setTimeout(() => {
                    const offset = new THREE.Vector3((Math.random() - 0.5) * 5.0, (Math.random() - 0.5) * 5.0, (Math.random() - 0.5) * 5.0);
                    this.particles.spawn(boss.mesh.position.clone().add(offset), 0xff0066, 20);
                    this.audio.playGuardExplosionSound();
                  }, delay);
                  delay += 120;
                }

                // Evaporate boss overseer
                this.scene.remove(boss.mesh);
                this.world.bossOverseer = null;
              } else {
                this.audio.playGuardDamageSound();
                
                // Update health text HUD
                const ratio = Math.max(0, boss.health / boss.maxHealth);
                boss.healthBarFg.scale.x = ratio;
                if (boss.healthTextCanvas && boss.healthTextCtx && boss.healthTextTexture) {
                  const ctx = boss.healthTextCtx;
                  ctx.clearRect(0, 0, 128, 48);
                  ctx.font = 'bold 24px "Courier New", monospace';
                  ctx.fillStyle = '#ffffff';
                  ctx.fillText(Math.round(ratio * 100) + '%', 64, 24);
                  boss.healthTextTexture.needsUpdate = true;
                }
              }
            }
            hit = true;
          }
        }

        if (hit || proj.timeLeft <= 0) {
          this.scene.remove(proj.mesh);
          this.projectiles.splice(i, 1);
        }
      }

      // Check collision: Player to cyclic lasers
      const lasers = this.world.getLasers();
      const playerRadius = this.controls.playerRadius;
      const playerHeight = this.controls.playerHeight;

      if (this.laserHitCooldown > 0) {
        this.laserHitCooldown -= delta;
      }

      if (this.laserHitCooldown <= 0) {
        for (const laser of lasers) {
          if (laser.isActive) {
            const d = this.distancePointToSegment(playerPos, laser.p1, laser.p2);
            const inHeight = playerPos.y - playerHeight <= laser.p1.y + 0.1 && playerPos.y >= laser.p1.y - 0.8;

            if (d < playerRadius + 0.15 && inHeight) {
              this.laserHitCooldown = 1.2; // 1.2s immune cooldown
              this.audio.playLaserHitSound();
              this.timeLeft = Math.max(0, this.timeLeft - 5.0);
              this.showPenaltySplash('-5.0s LASER GRID IMPACT');
              break;
            }
          }
        }
      }

      // Check collision: Player to teleporter pads
      const portals = this.world.getPortals();
      if (this.portalCooldown > 0) {
        this.portalCooldown -= delta;
      }

      if (this.portalCooldown <= 0) {
        const feetPos = playerPos.clone();
        feetPos.y -= this.controls.playerHeight;
        
        for (const portal of portals) {
          const dist = feetPos.distanceTo(portal.position);
          if (dist < 1.6) {
            const targetPortal = portals.find(p => p.id === portal.targetPortalId);
            if (targetPortal) {
              // Teleport player (camera represents head position)
              const newPos = targetPortal.position.clone();
              newPos.y += this.controls.playerHeight - 0.1;
              this.camera.position.copy(newPos);
              
              // Clear velocities to avoid sliding off
              this.controls.velocity.set(0, 0, 0);

              this.audio.playPortalWarpSound();
              this.portalCooldown = 1.6; // Cooldown to prevent instant loops
              this.showScoreSplash('SECTOR SHIFT WARP');
              break;
            }
          }
        }
      }

      // Check AI patrol drones chase & attack loops
      for (const guard of guards) {
        if (guard.isEvaporating) {
          // Spawn trail of ascending glowing orange sparks
          if (Math.random() < 0.28) {
            this.particles.spawn(guard.mesh.position, 0xff7700, 2);
          }
          continue;
        }
        const dist = playerPos.distanceTo(guard.mesh.position);

        // Sense range (12 units)
        if (dist < 12.0) {
          if (!guard.isAlert) {
            guard.isAlert = true;
            this.audio.playGuardAlertSound();
            this.showPenaltySplash('DRONE THREAT DETECTED');
          }
          guard.targetPlayer = playerPos;
        } else if (dist > 18.0) {
          if (guard.isAlert) {
            guard.isAlert = false;
            guard.targetPlayer = null;
          }
        }

        // Damage trigger range (1.8 units)
        if (dist < 1.8) {
          this.audio.playGuardHitSound();
          this.timeLeft = Math.max(0, this.timeLeft - 15.0);
          this.showPenaltySplash('-15.0s CORE DISCHARGE');

          // Vector pushback
          const pushBack = new THREE.Vector3().subVectors(playerPos, guard.mesh.position);
          pushBack.y = 0;
          pushBack.normalize();
          this.controls.velocity.addScaledVector(pushBack, 18.0); // Bounce off

          // Reset drone positions back to patrol start node
          guard.isAlert = false;
          guard.targetPlayer = null;
          guard.mesh.position.copy(guard.patrolNodes[0]);
        }
      }

      // Check fading platform triggers
      const standing = this.controls.standingPlatform;
      if (standing && standing.isFadingPlatform && standing.fadeState === 'idle') {
        standing.fadeState = 'fading';
        standing.fadeTimer = 1.2;
        this.audio.playPlatformFadeSound();
      }

      // Check gravity lifts
      const lifts = this.world.getGravityLifts();
      for (const lift of lifts) {
        const horizontalDist = new THREE.Vector2(playerPos.x, playerPos.z).distanceTo(new THREE.Vector2(lift.position.x, lift.position.z));
        const verticalCheck = playerPos.y >= lift.position.y && playerPos.y <= lift.position.y + lift.height;
        if (horizontalDist < lift.radius && verticalCheck) {
          this.controls.velocity.y = Math.min(11.0, this.controls.velocity.y + delta * 38.0);
          this.controls.jumpCount = 0;
        }
      }

      // Check gravity fields (Sector 8)
      const gravityFields = this.world.getGravityFields();
      let inGravityField = false;
      for (const field of gravityFields) {
        if (playerPos.x >= field.minX && playerPos.x <= field.maxX &&
            playerPos.z >= field.minZ && playerPos.z <= field.maxZ &&
            playerPos.y >= field.minY && playerPos.y <= field.maxY) {
          inGravityField = true;
          break;
        }
      }

      if (inGravityField) {
        if (!this.playerInGravityFieldLastFrame) {
          this.audio.playGravityInvertSound();
          this.playerInGravityFieldLastFrame = true;
        }
        this.controls.gravity = -24.0;
        this.controls.jumpCount = 0; // Reload double jump
        const vignette = document.getElementById('gravity-vignette');
        if (vignette) vignette.classList.add('active');
      } else {
        if (this.playerInGravityFieldLastFrame) {
          this.playerInGravityFieldLastFrame = false;
        }
        this.controls.gravity = 35.0; // Restore default gravity
        const vignette = document.getElementById('gravity-vignette');
        if (vignette) vignette.classList.remove('active');
      }

      const barriers = this.world.getBarriers();
      for (const b of barriers) {
        // Check y-overlap first
        const yOverlap = playerPos.y >= b.minY && (playerPos.y - playerHeight) <= b.maxY;
        if (!yOverlap) continue;

        // Check x-overlap
        const xOverlap = (playerPos.x + playerRadius) >= b.minX && (playerPos.x - playerRadius) <= b.maxX;
        if (!xOverlap) continue;

        // Check z-overlap
        const zOverlap = (playerPos.z + playerRadius) >= b.minZ && (playerPos.z - playerRadius) <= b.maxZ;
        if (!zOverlap) continue;

        // Overlapping! Calculate how deep the penetration is on each axis
        const distToMinX = Math.abs((playerPos.x + playerRadius) - b.minX);
        const distToMaxX = Math.abs(b.maxX - (playerPos.x - playerRadius));
        const minPenX = Math.min(distToMinX, distToMaxX);

        const distToMinZ = Math.abs((playerPos.z + playerRadius) - b.minZ);
        const distToMaxZ = Math.abs(b.maxZ - (playerPos.z - playerRadius));
        const minPenZ = Math.min(distToMinZ, distToMaxZ);

        // Push along the shortest axis
        if (minPenX < minPenZ) {
          if (distToMinX < distToMaxX) {
            playerPos.x -= minPenX;
          } else {
            playerPos.x += minPenX;
          }
          this.controls.velocity.x = 0;
        } else {
          if (distToMinZ < distToMaxZ) {
            playerPos.z -= minPenZ;
          } else {
            playerPos.z += minPenZ;
          }
          this.controls.velocity.z = 0;
        }
      }

      // Check player-boost rings intersections (Sector 9)
      const boostRings = this.world.getBoostRings();
      for (const ring of boostRings) {
        ring.cooldown = ring.cooldown || 0;
        if (ring.cooldown > 0) {
          ring.cooldown -= delta;
        } else {
          const toPlayer = new THREE.Vector3().subVectors(playerPos, ring.position);
          const distAlongNormal = toPlayer.dot(ring.direction);
          const perpDistVec = new THREE.Vector3().subVectors(toPlayer, ring.direction.clone().multiplyScalar(distAlongNormal));
          const distPerp = perpDistVec.length();

          if (Math.abs(distAlongNormal) < 2.0 && distPerp < ring.radius + 0.5) {
            ring.cooldown = 1.2; // 1.2s cooldown
            this.audio.playBoosterSound();
            this.showScoreSplash('HYPERLOOP ACCELERATION');
            
            // Apply strong forward velocity vector
            this.controls.velocity.addScaledVector(ring.direction, 45.0);
            this.controls.isBoosted = true;
            
            // Spawn wind tunnel particles
            this.particles.spawn(ring.position, 0xffee00, 30);
          }
        }
      }

      // Update Boss Overseer combat loops (Sector 9)
      const boss = this.world.getBossOverseer();
      if (boss) {
        boss.shootCooldown -= delta;
        if (boss.shootCooldown <= 0) {
          boss.shootCooldown = 2.0 + Math.random() * 1.5;
          this.audio.playBossHomingSound();

          // Spawn glowing homing sphere
          const missileGeo = new THREE.SphereGeometry(0.35, 8, 8);
          const missileMat = new THREE.MeshBasicMaterial({
            color: 0xff0066,
            transparent: true,
            opacity: 0.95
          });
          const missileMesh = new THREE.Mesh(missileGeo, missileMat);
          
          const missileEdges = new THREE.EdgesGeometry(missileGeo);
          const missileLineMat = new THREE.LineBasicMaterial({ color: 0xff00ff });
          const missileLines = new THREE.LineSegments(missileEdges, missileLineMat);
          missileMesh.add(missileLines);
          
          missileMesh.position.copy(boss.mesh.position);
          this.scene.add(missileMesh);
          
          boss.projectiles.push({
            mesh: missileMesh,
            velocity: new THREE.Vector3(0, 0, 0),
            speed: 9.0,
            life: 6.0
          });
        }

        // Update Boss projectiles
        for (let k = boss.projectiles.length - 1; k >= 0; k--) {
          const p = boss.projectiles[k];
          p.life -= delta;
          if (p.life <= 0) {
            this.scene.remove(p.mesh);
            boss.projectiles.splice(k, 1);
            continue;
          }

          const targetDir = new THREE.Vector3().subVectors(playerPos, p.mesh.position).normalize();
          if (p.velocity.lengthSq() === 0) {
            p.velocity.copy(targetDir);
          } else {
            p.velocity.lerp(targetDir, 3.5 * delta).normalize();
          }

          p.mesh.position.addScaledVector(p.velocity, p.speed * delta);
          this.particles.spawn(p.mesh.position, 0xff0066, 2);

          const distToPlayer = p.mesh.position.distanceTo(playerPos);
          if (distToPlayer < 1.6) {
            this.audio.playGuardHitSound();
            this.timeLeft = Math.max(0, this.timeLeft - 15.0);
            this.showPenaltySplash('-15.0s HYPER-MISSILE IMPACT');
            
            const pushBack = new THREE.Vector3().subVectors(playerPos, p.mesh.position);
            pushBack.y = 0.2;
            pushBack.normalize();
            this.controls.velocity.addScaledVector(pushBack, 15.0);

            this.particles.spawn(p.mesh.position, 0xff0066, 18);
            this.scene.remove(p.mesh);
            boss.projectiles.splice(k, 1);
          }
        }
      }

      // Check velocity booster pads
      if (this.velocityPadCooldown === undefined) this.velocityPadCooldown = 0;
      if (this.velocityPadCooldown > 0) {
        this.velocityPadCooldown -= delta;
      }
      if (this.velocityPadCooldown <= 0) {
        const pads = this.world.getVelocityPads();
        for (const pad of pads) {
          const horizontalDist = new THREE.Vector2(playerPos.x, playerPos.z).distanceTo(new THREE.Vector2(pad.position.x, pad.position.z));
          const verticalCheck = Math.abs(playerPos.y - pad.position.y) < 1.8;
          if (horizontalDist < 2.2 && verticalCheck) {
            this.velocityPadCooldown = 0.5;
            this.audio.playBoosterSound();
            this.showScoreSplash('VELOCITY ACCELERATION');
            
            const boostForce = pad.direction.clone().multiplyScalar(pad.force);
            this.controls.velocity.x = boostForce.x;
            this.controls.velocity.z = boostForce.z;
            this.controls.velocity.y = Math.max(this.controls.velocity.y, boostForce.y);
            this.controls.isBoosted = true;
            
            this.particles.spawn(pad.position, 0x00ffcc, 15);
            break;
          }
        }
      }

      // Check security searchlights
      const searchlights = this.world.getSearchlights();
      let playerDetectedThisFrame = false;
      for (const light of searchlights) {
        const distToSpot = new THREE.Vector2(playerPos.x, playerPos.z).distanceTo(new THREE.Vector2(light.target.x, light.target.z));
        const verticalCheck = Math.abs(playerPos.y - light.target.y) < 2.5;
        if (distToSpot < light.radius && verticalCheck) {
          playerDetectedThisFrame = true;
          break;
        }
      }

      if (playerDetectedThisFrame) {
        if (!this.world.isAlarmActive) {
          this.world.isAlarmActive = true;
          this.audio.playAlarmSound();
          this.showPenaltySplash('SECURITY SYSTEM COMPROMISED');
        }
        this.world.getGuards().forEach(guard => {
          guard.isAlert = true;
          guard.targetPlayer = playerPos;
        });
        this.alarmTimer = 4.0;
      } else {
        if (this.world.isAlarmActive) {
          if (this.alarmTimer === undefined) this.alarmTimer = 4.0;
          this.alarmTimer -= delta;
          if (this.alarmTimer <= 0) {
            this.world.isAlarmActive = false;
            this.showScoreSplash('SECURITY THREAT CLEARED');
            this.world.getGuards().forEach(guard => {
              guard.isAlert = false;
              guard.targetPlayer = null;
            });
          }
        }
      }

      // Check rotating sweepers
      if (this.sweeperHitCooldown === undefined) this.sweeperHitCooldown = 0;
      if (this.sweeperHitCooldown > 0) {
        this.sweeperHitCooldown -= delta;
      }
      if (this.sweeperHitCooldown <= 0) {
        const sweepers = this.world.getSweepers();
        const playerRadius = this.controls.playerRadius;
        const playerHeight = this.controls.playerHeight;
        for (const sw of sweepers) {
          const horizDist = new THREE.Vector2(playerPos.x, playerPos.z).distanceTo(new THREE.Vector2(sw.center.x, sw.center.z));
          const inHeight = playerPos.y - playerHeight <= sw.center.y + 0.15 && playerPos.y >= sw.center.y - 0.15;
          if (horizDist < sw.length && inHeight) {
            const angleToPlayer = Math.atan2(playerPos.z - sw.center.z, playerPos.x - sw.center.x);
            const diff1 = Math.abs(this.angleDifference(angleToPlayer, sw.angle));
            const diff2 = Math.abs(this.angleDifference(angleToPlayer, sw.angle + Math.PI));
            
            const sweepThickness = 0.28;
            if (diff1 < sweepThickness || diff2 < sweepThickness) {
              this.sweeperHitCooldown = 1.0;
              this.audio.playLaserHitSound();
              this.timeLeft = Math.max(0, this.timeLeft - 10.0);
              this.showPenaltySplash('-10.0s ROTATING SWEEPER CLASH');
              
              const push = new THREE.Vector3().subVectors(playerPos, sw.center);
              push.y = 0.2;
              push.normalize();
              this.controls.velocity.addScaledVector(push, 22.0);
              break;
            }
          }
        }
      }
    }

    // Update level assets
    this.world.update(time, delta);

    // Billboard active sentry health bars to face camera
    const camera = this.camera;
    this.world.getGuards().forEach(g => {
      if (g.healthBarGroup) {
        g.healthBarGroup.quaternion.copy(camera.quaternion);
      }
    });

    const boss = this.world.getBossOverseer();
    if (boss && boss.healthBarGroup) {
      boss.healthBarGroup.quaternion.copy(camera.quaternion);
    }

    this.particles.update(delta);
    this.drawRadar(time);

    // Render WebGL
    this.renderer.render(this.scene, this.camera);
  }
}

// Start app
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
