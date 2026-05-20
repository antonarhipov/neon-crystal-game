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
      }
    );
  }

  // Bind HUD buttons and Pointer Lock interactions
  bindEvents() {
    // Start button
    this.startBtn.addEventListener('click', () => {
      this.controls.controls.lock();
    });

    // Restart button
    this.restartBtn.addEventListener('click', () => {
      this.resetGame();
      this.controls.controls.lock();
    });

    // Play again button
    this.playAgainBtn.addEventListener('click', () => {
      this.resetGame();
      this.controls.controls.lock();
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
    });

    this.controls.controls.addEventListener('unlock', () => {
      if (this.isLevelSelecting) {
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
    
    this.world.loadLevel(1);
    this.controls.resetPosition();

    // Reset HUD DOM elements
    this.scoreCountEl.textContent = '0';
    this.targetCountEl.textContent = '15';
    this.timerTextEl.textContent = `${this.gameDuration.toFixed(1)}s`;
    this.timerFillEl.style.width = '100%';
    this.timerFillEl.classList.remove('warning');
    document.getElementById('level-display').textContent = '1';

    this.timer.reset();
    this.resetCombo();
  }

  // Reset combo tracking
  resetCombo() {
    this.comboMultiplier = 1;
    this.comboTimer = 0.0;
    this.comboContainer.classList.add('hidden');
    this.comboContainer.classList.remove('combo-active');
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
    
    if (this.currentLevel < 6) {
      this.nextLevelBtn.textContent = 'Enter Next Sector';
    } else {
      this.nextLevelBtn.textContent = 'Finalize Core Grid';
    }

    this.levelclearScreen.classList.remove('hidden');
  }

  // Next level loading
  proceedToNextLevel() {
    this.levelclearScreen.classList.add('hidden');
    
    if (this.currentLevel === 6) {
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
    }

    this.score = 0;
    this.timeLeft = this.gameDuration;
    this.gameState = 'PLAYING';
    
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
    }
    
    this.targetCountEl.textContent = this.totalCrystals;
    document.getElementById('level-display').textContent = this.currentLevel;
    
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
        for (const portal of portals) {
          const dist = playerPos.distanceTo(portal.position);
          if (dist < 1.4) {
            const targetPortal = portals.find(p => p.id === portal.targetPortalId);
            if (targetPortal) {
              // Teleport player
              this.camera.position.copy(targetPortal.position);
              this.camera.position.y += 0.5; // Landing clearance height
              
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
      const guards = this.world.getGuards();
      for (const guard of guards) {
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
