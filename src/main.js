import './style.css';
import * as THREE from 'three';
import { PlayerControls } from './controls.js';
import { GameWorld } from './world.js';
import { AudioManager } from './audio.js';
import { ParticleSystem } from './particles.js';

class GameApp {
  constructor() {
    this.gameState = 'START'; // START, PLAYING, GAMEOVER, VICTORY
    this.totalCrystals = 15;
    this.score = 0;
    this.gameDuration = 60.0; // 60 seconds game timer
    this.timeLeft = this.gameDuration;
    this.highScore = parseInt(localStorage.getItem('neon_crystal_high_score') || '0', 10);

    // Audio & Particles
    this.audio = new AudioManager();
    this.particles = null;

    // Timing
    this.clock = new THREE.Clock();

    // DOM Elements
    this.canvas = document.getElementById('game-canvas');
    this.scoreCountEl = document.getElementById('score-count');
    this.targetCountEl = document.getElementById('target-count');
    this.timerTextEl = document.getElementById('timer-text');
    this.timerFillEl = document.getElementById('timer-fill');
    this.soundBtnEl = document.getElementById('sound-btn');
    
    // Screen Overlays
    this.startScreen = document.getElementById('start-screen');
    this.gameoverScreen = document.getElementById('gameover-screen');
    this.victoryScreen = document.getElementById('victory-screen');
    
    // Action Buttons
    this.startBtn = document.getElementById('start-btn');
    this.restartBtn = document.getElementById('restart-btn');
    this.playAgainBtn = document.getElementById('play-again-btn');

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

    // Spawn crystals initial state
    this.world.spawnCrystals(this.totalCrystals);
    this.targetCountEl.textContent = this.totalCrystals;

    // Start Rendering
    this.animate();
  }

  // Set up Three.js WebGL rendering pipeline and lightning
  initThree() {
    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      70, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Lights
    // Ambient light (low intensity, purple/blue space glow)
    const ambientLight = new THREE.AmbientLight(0x1a1230, 0.65);
    this.scene.add(ambientLight);

    // Directional light (acting as nebula glow)
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
      // Fall off callback
      () => {
        // Warp sound
        this.audio.playRespawnSound();
        // Deduct time penalty
        this.timeLeft = Math.max(0, this.timeLeft - 10.0);
        this.showPenaltySplash('-10s FALLOUT PENALTY');
      },
      // Jump callback
      () => {
        this.audio.playJumpSound();
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

    // Sound toggle
    this.soundBtnEl.addEventListener('click', () => {
      const isMuted = this.audio.toggleMute();
      this.soundBtnEl.textContent = isMuted ? '🔇' : '🔊';
    });

    // Handle PointerLock events
    this.controls.controls.addEventListener('lock', () => {
      // User locks cursor -> start / resume gameplay
      this.startScreen.classList.add('hidden');
      this.gameoverScreen.classList.add('hidden');
      this.victoryScreen.classList.add('hidden');
      
      this.audio.init();
      this.audio.resume();
      this.audio.startAmbientDrone();
      
      if (this.gameState === 'START' || this.gameState === 'GAMEOVER' || this.gameState === 'VICTORY') {
        this.gameState = 'PLAYING';
      }
    });

    this.controls.controls.addEventListener('unlock', () => {
      // User escapes / unlocks cursor -> pause screen
      if (this.gameState === 'PLAYING') {
        // Show pause state in start screen
        this.startBtn.textContent = 'Resume Mission';
        this.startScreen.classList.remove('hidden');
      }
    });

    // Handle resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // Reset all game variables back to spawn state
  resetGame() {
    this.score = 0;
    this.timeLeft = this.gameDuration;
    this.gameState = 'PLAYING';
    
    // Spawn new crystal configuration
    this.world.spawnCrystals(this.totalCrystals);
    this.controls.resetPosition();

    // Reset HUD DOM elements
    this.scoreCountEl.textContent = '0';
    this.timerTextEl.textContent = `${this.gameDuration.toFixed(1)}s`;
    this.timerFillEl.style.width = '100%';
    this.timerFillEl.classList.remove('warning');

    // Reset clock
    this.clock.getDelta();
  }

  // Handle game-over state transitions
  triggerGameOver() {
    this.gameState = 'GAMEOVER';
    this.controls.controls.unlock();
    this.audio.stopAmbientDrone();
    this.audio.playGameOverSound();

    // Display Stats
    document.getElementById('go-score').textContent = `${this.score} / ${this.totalCrystals}`;
    document.getElementById('go-high-score').textContent = this.highScore;

    this.gameoverScreen.classList.remove('hidden');
  }

  // Handle victory state transitions
  triggerVictory() {
    this.gameState = 'VICTORY';
    this.controls.controls.unlock();
    this.audio.stopAmbientDrone();
    this.audio.playVictorySound();

    // Calculate score points (100 pts per crystal, plus 10 pts per remaining second)
    const timeBonus = Math.floor(this.timeLeft * 10);
    const finalScore = (this.score * 100) + timeBonus;

    // Check high score
    if (finalScore > this.highScore) {
      this.highScore = finalScore;
      localStorage.setItem('neon_crystal_high_score', finalScore.toString());
    }

    // Display Stats
    document.getElementById('vic-time').textContent = `${this.timeLeft.toFixed(1)}s`;
    document.getElementById('vic-bonus').textContent = `+${timeBonus}`;
    document.getElementById('vic-score').textContent = finalScore;

    this.victoryScreen.classList.remove('hidden');
  }

  // Collect event trigger
  collectCrystal(crystal) {
    // Remove mesh from world scene
    this.world.removeCrystal(crystal.id);
    
    // Play chime sound and spawn visual explosion sparks
    this.audio.playCollectSound();
    this.particles.spawnExplosion(crystal.mesh.position, 0xff00b4);

    // Update Score
    this.score++;
    this.scoreCountEl.textContent = this.score;

    // Pop up floating feedback splash at center screen
    this.showScoreSplash('+1 Crystal');

    // Win condition check
    if (this.score >= this.totalCrystals) {
      this.triggerVictory();
    }
  }

  // UI visual indicators
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

  // Draw HUD radar display representing remaining crystals and player orientation
  drawRadar(time) {
    const ctx = this.radarCtx;
    const w = this.radarCanvas.width;
    const h = this.radarCanvas.height;
    const center = w / 2;

    ctx.clearRect(0, 0, w, h);

    // 1. Radar Circular Grids (Neon Cyber look)
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
    // Calculate player look angle on horizontal XZ plane
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    const playerAngle = Math.atan2(camDir.x, camDir.z);

    const crystals = this.world.getCrystals();
    const radarRange = 45; // Max 3D distance that maps to the edge of the radar display
    const radarRadiusPixel = center - 5;

    crystals.forEach((c) => {
      // Relative vector
      const rx = c.basePosition.x - this.camera.position.x;
      const rz = c.basePosition.z - this.camera.position.z;
      const distance = Math.sqrt(rx * rx + rz * rz);

      // Rotate coordinates so player is looking UP (negative Z is forward)
      // This maps player's forward vector to the top of the radar screen
      const rotatedX = rx * Math.cos(-playerAngle) - rz * Math.sin(-playerAngle);
      const rotatedZ = rx * Math.sin(-playerAngle) + rz * Math.cos(-playerAngle);

      if (distance < radarRange) {
        // Map to pixels
        const scale = radarRadiusPixel / radarRange;
        const px = center + rotatedX * scale;
        // In radar coords, negative rotatedZ represents "forward" (UP)
        const py = center + rotatedZ * scale;

        // Draw crystal dot with radial neon glow
        ctx.fillStyle = '#ff00b4';
        ctx.shadowColor = '#ff00b4';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(px, py, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset
      }
    });

    // 4. Draw Player Triangle pointer in the exact center (pointing UP)
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(center, center - 6);
    ctx.lineTo(center - 5, center + 4);
    ctx.lineTo(center + 5, center + 4);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0; // Reset
  }

  // Core update animation loop
  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1); // Cap delta to avoid physics explosions on lag spikes
    const time = this.clock.getElapsedTime();

    if (this.gameState === 'PLAYING') {
      // Update timer countdown
      this.timeLeft = Math.max(0, this.timeLeft - delta);
      this.timerTextEl.textContent = `${this.timeLeft.toFixed(1)}s`;
      
      const ratio = this.timeLeft / this.gameDuration;
      this.timerFillEl.style.width = `${ratio * 100}%`;

      // Warning animations under 15 seconds remaining
      if (this.timeLeft <= 15.0) {
        this.timerFillEl.classList.add('warning');
      } else {
        this.timerFillEl.classList.remove('warning');
      }

      if (this.timeLeft <= 0) {
        this.triggerGameOver();
      }

      // 1. Update Player Movement (physics & static pillar bounds check)
      this.controls.update(delta, this.world.getColliders());

      // 2. Collision checking between player camera and crystals
      const crystals = this.world.getCrystals();
      const playerPos = this.camera.position;
      const collectThreshold = 1.6;

      for (let i = crystals.length - 1; i >= 0; i--) {
        const c = crystals[i];
        // 3D distance between player sphere center and crystal center
        const dist = playerPos.distanceTo(c.mesh.position);
        if (dist < collectThreshold) {
          this.collectCrystal(c);
        }
      }
    }

    // 3. Update active components animations (still animate stars/crystals/particles when paused)
    this.world.update(time);
    this.particles.update(delta);
    this.drawRadar(time);

    // 4. Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Start app
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
