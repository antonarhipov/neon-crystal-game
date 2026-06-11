import * as THREE from 'three';

export class GameWorld {
  constructor(scene) {
    this.scene = scene;
    
    // Collections
    this.colliders = [];      // Tall monolith columns
    this.crystals = [];       // Collector targets
    this.platforms = [];      // Floating boxes
    this.lasers = [];         // Cyclic lasers
    this.portals = [];        // Portal pads
    this.guards = [];         // Enemy drones
    this.ammoPacks = [];      // Bullet packs
    
    this.gravityLifts = [];
    this.velocityPads = [];
    this.searchlights = [];
    this.sweepers = [];
    this.isAlarmActive = false;

    // Collections for Sectors 7, 8, 9
    this.switches = [];
    this.phasePlatforms = [];
    this.gravityFields = [];
    this.barriers = [];
    this.boostRings = [];
    this.bossOverseer = null;
    
    this.monolithMeshes = []; 
    this.platformSize = 80;   
    
    // Core structural assets
    this.skyboxBuilt = false;
    this.floorBuilt = false;

    // Holographic Guides Overlay Group
    this.guidesGroup = new THREE.Group();
    this.scene.add(this.guidesGroup);
    this.guidesVisible = false; // Off by default
  }

  build() {
    if (!this.skyboxBuilt) {
      this.createSkybox();
      this.skyboxBuilt = true;
    }
    if (!this.floorBuilt) {
      this.createFloorGrid();
      this.floorBuilt = true;
    }
  }

  // Clear level-specific entities from the scene
  clearLevel() {
    this.crystals.forEach(c => this.scene.remove(c.mesh));
    this.crystals = [];

    this.ammoPacks.forEach(a => this.scene.remove(a.mesh));
    this.ammoPacks = [];

    this.platforms.forEach(p => this.scene.remove(p.mesh));
    this.platforms = [];

    this.lasers.forEach(l => {
      this.scene.remove(l.mesh);
      l.posts.forEach(p => this.scene.remove(p));
    });
    this.lasers = [];

    this.portals.forEach(port => this.scene.remove(port.mesh));
    this.portals = [];

    this.guards.forEach(g => this.scene.remove(g.mesh));
    this.guards = [];

    this.monolithMeshes.forEach(m => this.scene.remove(m));
    this.monolithMeshes = [];
    this.colliders = [];

    this.gravityLifts.forEach(l => {
      this.scene.remove(l.mesh);
      l.innerRings.forEach(r => this.scene.remove(r));
    });
    this.gravityLifts = [];

    this.velocityPads.forEach(p => {
      this.scene.remove(p.mesh);
      this.scene.remove(p.arrowMesh);
    });
    this.velocityPads = [];

    this.searchlights.forEach(s => {
      this.scene.remove(s.mesh);
      this.scene.remove(s.lightSpotMesh);
    });
    this.searchlights = [];

    this.sweepers.forEach(sw => {
      this.scene.remove(sw.mesh);
    });
    this.sweepers = [];

    // Clear Sectors 7, 8, 9 entities
    this.switches.forEach(s => this.scene.remove(s.mesh));
    this.switches = [];

    this.phasePlatforms.forEach(p => this.scene.remove(p.mesh));
    this.phasePlatforms = [];

    this.gravityFields.forEach(f => {
      this.scene.remove(f.mesh);
      if (f.particlesGroup) this.scene.remove(f.particlesGroup);
    });
    this.gravityFields = [];

    this.barriers.forEach(b => {
      this.scene.remove(b.mesh);
    });
    this.barriers = [];

    this.boostRings.forEach(r => this.scene.remove(r.mesh));
    this.boostRings = [];

    if (this.bossOverseer) {
      this.scene.remove(this.bossOverseer.mesh);
      if (this.bossOverseer.shieldMesh) this.scene.remove(this.bossOverseer.shieldMesh);
      if (this.bossOverseer.projectiles) {
        this.bossOverseer.projectiles.forEach(p => this.scene.remove(p.mesh));
      }
      this.bossOverseer = null;
    }

    this.isAlarmActive = false;

    // Clear guides meshes
    while (this.guidesGroup.children.length > 0) {
      const child = this.guidesGroup.children[0];
      this.guidesGroup.remove(child);
    }
  }

  // Toggle visibility of navigation guides
  toggleNavigationGuides(visible) {
    this.guidesVisible = visible;
    this.guidesGroup.visible = visible;
  }

  // Load level layouts (1, 2, or 3)
  loadLevel(levelNumber) {
    this.clearLevel();
    
    if (levelNumber === 1) {
      // LEVEL 1: Flat arena with basic monolith columns, 15 crystals scattered
      this.createMonoliths([
        { x: -18, z: -18, r: 2.2, h: 18 },
        { x: 18, z: -18, r: 2.2, h: 18 },
        { x: -18, z: 18, r: 2.2, h: 18 },
        { x: 18, z: 18, r: 2.2, h: 18 },
        { x: 0, z: -25, r: 3.5, h: 26 },
        { x: -28, z: 0, r: 2.8, h: 12 },
        { x: 28, z: 0, r: 2.8, h: 12 }
      ]);
      
      this.spawnCrystalsLevel1(15);

    } else if (levelNumber === 2) {
      // LEVEL 2: Calibrated layout. Platforms slightly closer to avoid dead jumps.
      this.createMonoliths([
        { x: -22, z: -22, r: 2.0, h: 12 },
        { x: 22, z: -22, r: 2.0, h: 12 },
        { x: -22, z: 22, r: 2.0, h: 12 },
        { x: 22, z: 22, r: 2.0, h: 12 }
      ]);

      // Static Floating Platforms
      // Format: createPlatform(x, y, z, w, h, d, borderNeonColor, movingParams)
      this.createPlatform(0, 4, 14, 14, 0.8, 14, 0x00f0ff);      // Platform A (Medium center front)
      this.createPlatform(-15, 8, 0, 11, 0.8, 11, 0xff00b4);     // Platform B (Left mid)
      this.createPlatform(15, 8, 0, 11, 0.8, 11, 0xff00b4);      // Platform C (Right mid)
      this.createPlatform(0, 11, -14, 14, 0.8, 14, 0x00f0ff);    // Platform D (High center back)

      // Moving Platforms
      // Moving Plat 1: Vertically between y=0 and y=4 at (x=-8, z=14)
      this.createPlatform(-8, 0, 14, 6, 0.4, 6, 0xffee00, {
        targetX: -8, targetY: 4, targetZ: 14, speed: 1.5
      });
      // Moving Plat 2: Diagonal/Horizontal at y=8 between Plat B and D
      this.createPlatform(-12, 8, -6, 6, 0.4, 6, 0xffee00, {
        targetX: -5, targetY: 9.5, targetZ: -12, speed: 1.2
      });
      // Moving Plat 3: Vertically between y=4 and y=11 at (x=8, z=-14)
      this.createPlatform(8, 4, -14, 6, 0.4, 6, 0xffee00, {
        targetX: 8, targetY: 11, targetZ: -14, speed: 1.6
      });

      // Cyclic lasers (crossing barriers on floor)
      this.createLaser(-25, 0, -5, 0, 0, 2.2, 1.8);
      this.createLaser(5, 0, 25, 0, 0, 2.2, 1.8);
      this.createLaser(0, -25, 0, -5, 0, 2.5, 1.5);
      this.createLaser(0, 5, 0, 25, 0, 2.5, 1.5);

      this.spawnCrystalsLevel2();
      this.buildNavigationGuides(2);

    } else if (levelNumber === 3) {
      // LEVEL 3: Calibrated Corner Platforms & Portal Routes
      this.createMonoliths([
        { x: -25, z: -25, r: 2.2, h: 10 },
        { x: 25, z: 25, r: 2.2, h: 10 }
      ]);

      // Static Platforms
      this.createPlatform(-16, 4, -16, 11, 0.8, 11, 0x00f0ff);   // Plat 1 (Low corner)
      this.createPlatform(16, 4, -16, 11, 0.8, 11, 0x00f0ff);    // Plat 2 (Low corner)
      this.createPlatform(-16, 8, 16, 11, 0.8, 11, 0xff00b4);    // Plat 3 (Mid corner)
      this.createPlatform(16, 8, 16, 11, 0.8, 11, 0xff00b4);     // Plat 4 (Mid corner)
      this.createPlatform(0, 11, 0, 15, 0.8, 15, 0xffee00);      // Plat 5 (Central High)

      // Moving Platforms
      // Vertical elevator to Plat 5
      this.createPlatform(0, 0, -18, 6, 0.4, 6, 0xffee00, {
        targetX: 0, targetY: 11, targetZ: -18, speed: 1.5
      });
      // Horizontal connector at y=8
      this.createPlatform(0, 8, 16, 6, 0.4, 6, 0x00f0ff, {
        targetX: 0, targetY: 8, targetZ: 7, speed: 1.8
      });

      // Teleporters (Portal Pads pairs)
      // Portal Pair A (Magenta)
      const pa1 = this.createPortal(-16, 4.8, -16, 0xff00b4);
      const pa2 = this.createPortal(16, 8.8, 16, 0xff00b4);
      pa1.targetPortalId = pa2.id;
      pa2.targetPortalId = pa1.id;

      // Portal Pair B (Cyan)
      const pb1 = this.createPortal(16, 4.8, -16, 0x00f0ff);
      const pb2 = this.createPortal(-16, 8.8, 16, 0x00f0ff);
      pb1.targetPortalId = pb2.id;
      pb2.targetPortalId = pb1.id;

      // Portal Pair C (Yellow)
      const pc1 = this.createPortal(0, 0.02, 24, 0xffee00);
      const pc2 = this.createPortal(0, 11.8, 0, 0xffee00);
      pc1.targetPortalId = pc2.id;
      pc2.targetPortalId = pc1.id;

      // Lasers
      this.createLaser(-21, -16, -11, -16, 4.0, 2.0, 2.0); // Blocks Plat 1
      this.createLaser(11, -16, 21, -16, 4.0, 2.0, 2.0);  // Blocks Plat 2
      this.createLaser(-5, 0, 5, 0, 11.0, 1.8, 1.8);       // Sweeps Plat 5
      this.createLaser(-10, 0, 10, 0, 0, 2.2, 1.5);        // Floor lane obstacle

      // AI Patrol Guards (Sector 3: 2 Health)
      this.createGuard([
        { x: -16, y: 0, z: -16 },
        { x: -16, y: 0, z: 16 },
        { x: 16, y: 0, z: 16 },
        { x: 16, y: 0, z: -16 }
      ], 4.5, 2);

      this.createGuard([
        { x: -5, y: 11, z: -5 },
        { x: 5, y: 11, z: -5 },
        { x: 5, y: 11, z: 5 },
        { x: -5, y: 11, z: 5 }
      ], 3.8, 2);

      this.createGuard([
        { x: -28, y: 0, z: -25 },
        { x: 28, y: 0, z: -25 }
      ], 5.5, 2);

      this.spawnCrystalsLevel3();
      this.buildNavigationGuides(3);
    } else if (levelNumber === 4) {
      // LEVEL 4: The Kinetic Circuit (Velocity Pads & Gravity Lifts)
      this.createMonoliths([
        { x: -30, z: -30, r: 2.5, h: 10 },
        { x: 30, z: -30, r: 2.5, h: 10 },
        { x: -30, z: 30, r: 2.5, h: 10 },
        { x: 30, z: 30, r: 2.5, h: 10 }
      ]);

      // Platforms
      this.createPlatform(0, 10, 0, 16, 0.8, 16, 0xffee00);       // Central High Plat
      this.createPlatform(-18, 6, 8, 8, 0.8, 8, 0x00f0ff);        // Left Plat
      this.createPlatform(18, 6, 8, 8, 0.8, 8, 0x00f0ff);         // Right Plat
      this.createPlatform(0, 5, -16, 8, 0.8, 8, 0xff00b4);        // Back Plat

      // Gravity Lifts
      this.createGravityLift(-18, 0, 8, 2.2, 7.0);                // Lift to Left Plat
      this.createGravityLift(18, 0, 8, 2.2, 7.0);                 // Lift to Right Plat

      // Velocity Booster Pads
      this.createVelocityPad(-18, 6.8, 8, 3, 3, 1, 0.25, -0.5, 32);  // Left plat -> Central
      this.createVelocityPad(18, 6.8, 8, 3, 3, -1, 0.25, -0.5, 32); // Right plat -> Central
      
      this.createVelocityPad(0, 0, -26, 3, 3, 0, 0.4, 1, 35);        // Floor pad -> Back Plat
      this.createVelocityPad(0, 5.8, -16, 3, 3, 0, 0.35, 1, 32);     // Back plat -> Central

      // Lasers
      this.createLaser(-10, 0, 10, 0, 0, 2.0, 1.8);
      this.createLaser(0, -10, 0, 10, 0, 2.0, 1.8);

      this.spawnCrystalsLevel4();
      this.buildNavigationGuides(4);

    } else if (levelNumber === 5) {
      // LEVEL 5: The Sentinel Keep (Searchlights & portals & guards)
      this.createMonoliths([
        { x: -12, z: -12, r: 1.8, h: 20 },
        { x: 12, z: -12, r: 1.8, h: 20 },
        { x: -12, z: 12, r: 1.8, h: 20 },
        { x: 12, z: 12, r: 1.8, h: 20 },
        { x: 0, z: -32, r: 2.2, h: 15 }
      ]);

      // Platforms
      this.createPlatform(-18, 6, -18, 12, 0.8, 12, 0x00f0ff);    // Corner plat 1
      this.createPlatform(18, 6, -18, 12, 0.8, 12, 0x00f0ff);     // Corner plat 2
      this.createPlatform(-18, 11, 18, 12, 0.8, 12, 0xff00b4);    // High corner plat 3
      this.createPlatform(18, 11, 18, 12, 0.8, 12, 0xff00b4);     // High corner plat 4
      
      // Portals
      const p1 = this.createPortal(-18, 6.8, -18, 0xff00b4);
      const p2 = this.createPortal(18, 11.8, 18, 0xff00b4);
      p1.targetPortalId = p2.id;
      p2.targetPortalId = p1.id;

      const p3 = this.createPortal(18, 6.8, -18, 0x00f0ff);
      const p4 = this.createPortal(-18, 11.8, 18, 0x00f0ff);
      p3.targetPortalId = p4.id;
      p4.targetPortalId = p3.id;

      // Timed Moving Platform Gates (rising barriers)
      this.createPlatform(-12, 0, 0, 1.0, 6.0, 8.0, 0xffee00, {
        targetX: -12, targetY: 6, targetZ: 0, speed: 0.8
      });
      this.createPlatform(12, 0, 0, 1.0, 6.0, 8.0, 0xffee00, {
        targetX: 12, targetY: 6, targetZ: 0, speed: 0.8
      });

      // Security Searchlights
      this.createSearchlight(-20, 24, -10, 8.0, 1.2, 3.2);       // Left
      this.createSearchlight(20, 24, -10, 8.0, 1.2, 3.2);        // Right
      this.createSearchlight(0, 24, 18, 9.0, 1.5, 3.6);          // Center

      // Patrol Guards (Sector 5: 2 Health)
      this.createGuard([
        { x: -28, y: 0, z: -15 },
        { x: -28, y: 0, z: 15 },
        { x: -12, y: 0, z: 15 }
      ], 4.2, 2);

      this.createGuard([
        { x: 28, y: 0, z: -15 },
        { x: 28, y: 0, z: 15 },
        { x: 12, y: 0, z: 15 }
      ], 4.2, 2);

      this.spawnCrystalsLevel5();
      this.buildNavigationGuides(5);

    } else if (levelNumber === 6) {
      // LEVEL 6: The Glitch Void (Fading Platforms & Rotating central sweepers)
      // Static platforms
      this.createPlatform(0, 3, 26, 12, 0.8, 12, 0x00f0ff);       // Spawn Static Base
      this.createPlatform(0, 11, -26, 12, 0.8, 12, 0xffee00);     // Far Static Target

      // Fading platforms
      this.createPlatform(0, 5, 14, 6, 0.6, 6, 0xff00ff, null, true);   // Fade Platform 1
      this.createPlatform(-8, 7, 3, 6, 0.6, 6, 0xff00ff, null, true);   // Fade Platform 2 (Left)
      this.createPlatform(8, 7, 3, 6, 0.6, 6, 0xff00ff, null, true);    // Fade Platform 3 (Right)
      this.createPlatform(0, 9, -10, 6, 0.6, 6, 0xff00ff, null, true);  // Fade Platform 4
      
      // Recovery lift in center
      this.createGravityLift(0, 0, 0, 3.0, 7.0);

      // Rotating Laser Sweepers
      this.createSweeper(-15, 0, -3, 11, 2.0);                    // Sweeper Left
      this.createSweeper(15, 0, -3, 11, -2.0);                    // Sweeper Right

      this.spawnCrystalsLevel6();
      this.buildNavigationGuides(6);
    } else if (levelNumber === 7) {
      // LEVEL 7: Shifting Hologram Grid (Switches & Decoys)
      this.createMonoliths([
        { x: -25, z: -25, r: 2.0, h: 14 },
        { x: 25, z: -25, r: 2.0, h: 14 },
        { x: -25, z: 25, r: 2.0, h: 14 },
        { x: 25, z: 25, r: 2.0, h: 14 }
      ]);

      // Spawn Static Platforms
      this.createPlatform(0, 4, 26, 10, 0.8, 10, 0x00f0ff);       // Spawn Base
      this.createPlatform(-18, 6, 10, 6, 0.8, 6, 0xff00b4);       // Switch 1 Platform
      this.createPlatform(18, 8, -10, 6, 0.8, 6, 0xff00b4);       // Switch 2 Platform
      this.createPlatform(0, 11, -32, 10, 0.8, 10, 0xffee00);     // Target platform

      // Z-axis stepping stones (make platforms reachable)
      this.createPlatform(0, 5, 17, 4, 0.6, 4, 0x00f0ff);         // Static stepping platform 1
      this.createPhasePlatform(0, 6, 8.5, 4, 0.6, 4, 0x00ffcc, 'phase1'); // Phased stepping platform 2
      this.createPlatform(0, 8, -8, 4, 0.6, 4, 0x00f0ff);         // Static stepping platform 3
      this.createPhasePlatform(0, 10, -24, 4, 0.6, 4, 0x00ffcc, 'phase2'); // Phased stepping platform 4

      // Phase Platforms (controlled by switches)
      this.createPhasePlatform(0, 7, 0, 8, 0.8, 8, 0x00ffcc, 'phase1');
      this.createPhasePlatform(0, 9, -16, 8, 0.8, 8, 0x00ffcc, 'phase2');

      // Switches
      this.createSwitch(-18, 6.8, 10, 'switch1', 'phase1');
      this.createSwitch(18, 8.8, -10, 'switch2', 'phase2');

      // Portals for Switch Platforms
      const p1 = this.createPortal(-3, 4.8, 26, 0x00f0ff);
      const p2 = this.createPortal(-18, 6.8, 10, 0x00f0ff);
      p1.targetPortalId = p2.id;
      p2.targetPortalId = p1.id;

      const p3 = this.createPortal(3, 7.8, 0, 0xff00b4);
      const p4 = this.createPortal(18, 8.8, -10, 0xff00b4);
      p3.targetPortalId = p4.id;
      p4.targetPortalId = p3.id;

      // Guards (Patrol Drones & Holographic Decoys)
      // Real Sentry drone
      this.createGuard([
        { x: -16, y: 0, z: -10 },
        { x: 16, y: 0, z: -10 }
      ], 4.2, 2);

      // Decoy 1 (patrolling around Spawn platform)
      this.createGuard([
        { x: -10, y: 4, z: 20 },
        { x: 10, y: 4, z: 20 }
      ], 3.5, 1);
      this.guards[this.guards.length - 1].isDecoy = true;

      // Decoy 2 (patrolling around Target platform)
      this.createGuard([
        { x: -8, y: 11, z: -28 },
        { x: 8, y: 11, z: -28 }
      ], 4.0, 1);
      this.guards[this.guards.length - 1].isDecoy = true;

      this.spawnCrystalsLevel7();
      this.buildNavigationGuides(7);

    } else if (levelNumber === 8) {
      // LEVEL 8: Gravitational Nexus (Gravity fields & destructible barriers)
      this.createMonoliths([
        { x: -20, z: -20, r: 1.8, h: 25 },
        { x: 20, z: -20, r: 1.8, h: 25 },
        { x: 0, z: 25, r: 2.2, h: 12 }
      ]);

      // Platforms
      this.createPlatform(0, 3, 26, 10, 0.8, 10, 0x00f0ff);       // Spawn platform
      this.createPlatform(-15, 4, 10, 8, 0.8, 8, 0xff00b4);       // Platform A (Low)
      this.createPlatform(0, 22, 0, 14, 0.8, 14, 0xffee00);       // Platform B (High ceiling)
      this.createPlatform(15, 12, -10, 8, 0.8, 8, 0xff00b4);      // Platform C (Mid)
      this.createPlatform(0, 14, -28, 10, 0.8, 10, 0x00f0ff);      // Target Platform

      // Gravity Inversion Fields (Floats player up to high platforms)
      this.createGravityField(0, 3, 10, 8, 19, 8);                 // Field 1 (Floor to ceiling platform)
      this.createGravityField(0, 0, -15, 8, 14, 8);                // Field 2 (Floor to Target platform)

      // Destructible Force Barriers
      this.createBarrier(-15, 4, 6, 8, 4, 0.5);                   // Barrier 1 (Low deck)
      this.createBarrier(0, 22.8, -6, 14, 4, 0.5);                 // Barrier 2 (Ceiling deck)

      // Guards
      this.createGuard([
        { x: -15, y: 4, z: 12 },
        { x: -15, y: 4, z: -2 }
      ], 4.0, 2);

      this.createGuard([
        { x: -5, y: 22.8, z: 0 },
        { x: 5, y: 22.8, z: 0 }
      ], 4.2, 2);

      this.spawnCrystalsLevel8();
      this.buildNavigationGuides(8);

    } else if (levelNumber === 9) {
      // LEVEL 9: The Hyperloop Core (Booster Rings & Final Boss)
      this.createPlatform(0, 4, 30, 12, 0.8, 12, 0x00f0ff);       // Spawn base
      this.createPlatform(0, 10, -30, 24, 0.8, 24, 0xff00b4);     // Boss Arena platform

      // Hyperloop Speed Boost Rings
      this.createBoostRing(0, 6.5, 18, -0.15, Math.PI, 0, 2.5);               // Launches player across 40 unit gap!
      this.createBoostRing(12, 11, -30, 0, Math.PI / 2, 0, 2.2);   // Circle path boost ring (X-axis)
      this.createBoostRing(-12, 11, -30, 0, -Math.PI / 2, 0, 2.2); // Circle path boost ring (X-axis)

      // Boss Sentry Overseer (6 HP, stationary at center of arena)
      this.createBossOverseer(0, 12.2, -30);

      this.spawnCrystalsLevel9();
      this.buildNavigationGuides(9);
    }

    // Spawn ammunition packs across all levels
    this.spawnAmmoPacks(levelNumber);

    // Keep guides visibility setting
    this.guidesGroup.visible = this.guidesVisible;
  }

  // Create Holographic visual path connector lines
  buildNavigationGuides(levelNumber) {
    const createDashLine = (p1, p2, color) => {
      const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const mat = new THREE.LineDashedMaterial({
        color: color,
        dashSize: 0.8,
        gapSize: 0.5,
        transparent: true,
        opacity: 0.65
      });
      const line = new THREE.Line(geo, mat);
      line.computeLineDistances(); // Required for dashed lines
      this.guidesGroup.add(line);
    };

    const createArcLine = (p1, p2, color) => {
      const points = [];
      const segments = 24;
      const height = 6.0;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const pt = new THREE.Vector3().lerpVectors(p1, p2, t);
        // Elevate mid section like a parabola
        pt.y += Math.sin(t * Math.PI) * height;
        points.push(pt);
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.8
      });
      const line = new THREE.Line(geo, mat);
      this.guidesGroup.add(line);

      // Add a small helper rings along the arc path representing flow direction
      for (let j = 1; j < segments; j += 4) {
        const rGeo = new THREE.RingGeometry(0.15, 0.22, 8);
        const rMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(rGeo, rMat);
        ring.position.copy(points[j]);
        
        // Orient ring facing the next point on arc
        ring.lookAt(points[j + 1]);
        this.guidesGroup.add(ring);
      }
    };

    if (levelNumber === 2) {
      // Guide 1: Floor -> Elevator 1 -> Plat A
      createDashLine(new THREE.Vector3(-8, 0.1, 14), new THREE.Vector3(-8, 4.1, 14), 0xffee00); // Vertical rise
      createDashLine(new THREE.Vector3(-8, 4.1, 14), new THREE.Vector3(0, 4.1, 14), 0x00f0ff);  // Leap to Plat A

      // Guide 2: Plat B -> Elevator 2 -> Plat D
      createDashLine(new THREE.Vector3(-15, 8.1, 0), new THREE.Vector3(-12, 8.1, -6), 0xff00b4);
      createDashLine(new THREE.Vector3(-5, 9.6, -12), new THREE.Vector3(0, 11.1, -14), 0x00f0ff);

      // Guide 3: Plat C -> Elevator 3 -> Plat D
      createDashLine(new THREE.Vector3(15, 8.1, 0), new THREE.Vector3(8, 4.1, -14), 0xff00b4);
      createDashLine(new THREE.Vector3(8, 4.1, -14), new THREE.Vector3(8, 11.1, -14), 0xffee00);
      createDashLine(new THREE.Vector3(8, 11.1, -14), new THREE.Vector3(0, 11.1, -14), 0x00f0ff);

    } else if (levelNumber === 3) {
      // Guide Arc 1: Portal A Magenta Route
      createArcLine(new THREE.Vector3(-16, 4.8, -16), new THREE.Vector3(16, 8.8, 16), 0xff00b4);

      // Guide Arc 2: Portal B Cyan Route
      createArcLine(new THREE.Vector3(16, 4.8, -16), new THREE.Vector3(-16, 8.8, 16), 0x00f0ff);

      // Guide Arc 3: Portal C Yellow Route
      createArcLine(new THREE.Vector3(0, 0.1, 24), new THREE.Vector3(0, 11.8, 0), 0xffee00);

      // Guide 4: Floor -> Elevator -> Plat 5
      createDashLine(new THREE.Vector3(0, 0.1, -18), new THREE.Vector3(0, 11.1, -18), 0xffee00);
      createDashLine(new THREE.Vector3(0, 11.1, -18), new THREE.Vector3(0, 11.1, 0), 0xffee00);
    } else if (levelNumber === 4) {
      // Gravity column lines
      createDashLine(new THREE.Vector3(-18, 0.1, 8), new THREE.Vector3(-18, 6.1, 8), 0x00ff66);
      createDashLine(new THREE.Vector3(18, 0.1, 8), new THREE.Vector3(18, 6.1, 8), 0x00ff66);
      
      // Accelerator arcs
      createArcLine(new THREE.Vector3(-18, 6.8, 8), new THREE.Vector3(0, 10.8, 0), 0x00ffcc);
      createArcLine(new THREE.Vector3(18, 6.8, 8), new THREE.Vector3(0, 10.8, 0), 0x00ffcc);
      createArcLine(new THREE.Vector3(0, 0.1, -26), new THREE.Vector3(0, 5.8, -16), 0x00ffcc);
      createArcLine(new THREE.Vector3(0, 5.8, -16), new THREE.Vector3(0, 10.8, 0), 0x00ffcc);
    } else if (levelNumber === 5) {
      // Portal arcs
      createArcLine(new THREE.Vector3(-20, 6.8, -20), new THREE.Vector3(20, 11.8, 20), 0xff00b4);
      createArcLine(new THREE.Vector3(20, 6.8, -20), new THREE.Vector3(-20, 11.8, 20), 0x00f0ff);
      
      // Gate guides
      createDashLine(new THREE.Vector3(-12, 0.1, 0), new THREE.Vector3(-12, 6.1, 0), 0xffee00);
      createDashLine(new THREE.Vector3(12, 0.1, 0), new THREE.Vector3(12, 6.1, 0), 0xffee00);
    } else if (levelNumber === 6) {
      // Fading step stones progression
      createDashLine(new THREE.Vector3(0, 3.8, 26), new THREE.Vector3(0, 5.8, 14), 0xff00ff);
      createDashLine(new THREE.Vector3(0, 5.8, 14), new THREE.Vector3(-8, 7.8, 3), 0xff00ff);
      createDashLine(new THREE.Vector3(0, 5.8, 14), new THREE.Vector3(8, 7.8, 3), 0xff00ff);
      createDashLine(new THREE.Vector3(-8, 7.8, 3), new THREE.Vector3(0, 9.8, -10), 0xff00ff);
      createDashLine(new THREE.Vector3(8, 7.8, 3), new THREE.Vector3(0, 9.8, -10), 0xff00ff);
      createDashLine(new THREE.Vector3(0, 9.8, -10), new THREE.Vector3(0, 11.8, -26), 0xff00ff);
    } else if (levelNumber === 7) {
      // LEVEL 7 Guides: Hologram grid, switches, stepping stones, and portal warps
      // Portal 1 (Cyan) Warp to Switch 1 platform
      createArcLine(new THREE.Vector3(-3, 4.8, 26), new THREE.Vector3(-18, 6.8, 10), 0x00f0ff);
      
      // Step stones to Phase Platform 1
      createDashLine(new THREE.Vector3(0, 4.4, 26), new THREE.Vector3(0, 5.3, 17), 0x00ffcc);
      createDashLine(new THREE.Vector3(0, 5.3, 17), new THREE.Vector3(0, 6.3, 8.5), 0x00ffcc);
      createDashLine(new THREE.Vector3(0, 6.3, 8.5), new THREE.Vector3(0, 7.4, 0), 0x00ffcc);

      // Portal 3 (Magenta) Warp to Switch 2 platform
      createArcLine(new THREE.Vector3(3, 7.8, 0), new THREE.Vector3(18, 8.8, -10), 0xff00b4);

      // Step stones to Phase Platform 2 and Target platform
      createDashLine(new THREE.Vector3(0, 7.4, 0), new THREE.Vector3(0, 8.3, -8), 0x00ffcc);
      createDashLine(new THREE.Vector3(0, 8.3, -8), new THREE.Vector3(0, 9.4, -16), 0x00ffcc);
      createDashLine(new THREE.Vector3(0, 9.4, -16), new THREE.Vector3(0, 10.3, -24), 0x00ffcc);
      createDashLine(new THREE.Vector3(0, 10.3, -24), new THREE.Vector3(0, 11.4, -32), 0x00ffcc);
    } else if (levelNumber === 8) {
      // LEVEL 8 Guides: Gravitational fields and dropdowns
      // Spawn into Gravity field 1 -> Platform B (High)
      createDashLine(new THREE.Vector3(0, 3.4, 26), new THREE.Vector3(0, 3.4, 10), 0x9900ff);
      createDashLine(new THREE.Vector3(0, 3.4, 10), new THREE.Vector3(0, 22.4, 10), 0x9900ff);
      createDashLine(new THREE.Vector3(0, 22.4, 10), new THREE.Vector3(0, 22.4, 0), 0x9900ff);

      // High Platform B dropdowns to Low Platform A and Mid Platform C
      createDashLine(new THREE.Vector3(0, 22.4, 0), new THREE.Vector3(-15, 4.4, 10), 0xff00b4);
      createDashLine(new THREE.Vector3(0, 22.4, 0), new THREE.Vector3(15, 12.4, -10), 0xff00b4);

      // Platform C jump into Gravity field 2 -> Target Platform
      createDashLine(new THREE.Vector3(15, 12.4, -10), new THREE.Vector3(0, 12.4, -15), 0x9900ff);
      createDashLine(new THREE.Vector3(0, 12.4, -15), new THREE.Vector3(0, 14.4, -15), 0x9900ff);
      createDashLine(new THREE.Vector3(0, 14.4, -15), new THREE.Vector3(0, 14.4, -28), 0x9900ff);
    } else if (levelNumber === 9) {
      // LEVEL 9 Guides: Speed Boost Ring trajectory
      createArcLine(new THREE.Vector3(0, 4.4, 30), new THREE.Vector3(0, 10.4, -30), 0x00f0ff);
    }
  }

  // 1. Create a deep space skybox using star particles and soft nebula clouds
  createSkybox() {
    const starCount = 1500;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const radius = 250 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = radius * Math.cos(phi);

      const colorType = Math.random();
      if (colorType < 0.7) {
        starColors[i * 3] = 1.0;
        starColors[i * 3 + 1] = 1.0;
        starColors[i * 3 + 2] = 1.0;
      } else if (colorType < 0.9) {
        starColors[i * 3] = 0.7;
        starColors[i * 3 + 1] = 0.85;
        starColors[i * 3 + 2] = 1.0;
      } else {
        starColors[i * 3] = 1.0;
        starColors[i * 3 + 1] = 0.75;
        starColors[i * 3 + 2] = 0.5;
      }
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true
    });

    const starfield = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(starfield);

    const createNebulaTexture = (baseColor) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createRadialGradient(256, 256, 10, 256, 256, 250);
      grad.addColorStop(0, baseColor);
      grad.addColorStop(0.3, baseColor.replace('1.0)', '0.3)'));
      grad.addColorStop(0.6, baseColor.replace('1.0)', '0.08)'));
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      return new THREE.CanvasTexture(canvas);
    };

    const nebulaGeo1 = new THREE.PlaneGeometry(300, 300);
    const nebulaMat1 = new THREE.MeshBasicMaterial({
      map: createNebulaTexture('rgba(255, 0, 128, 1.0)'),
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const nebula1 = new THREE.Mesh(nebulaGeo1, nebulaMat1);
    nebula1.position.set(-150, 100, -200);
    nebula1.lookAt(0, 0, 0);
    this.scene.add(nebula1);

    const nebulaGeo2 = new THREE.PlaneGeometry(400, 400);
    const nebulaMat2 = new THREE.MeshBasicMaterial({
      map: createNebulaTexture('rgba(0, 240, 255, 1.0)'),
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const nebula2 = new THREE.Mesh(nebulaGeo2, nebulaMat2);
    nebula2.position.set(180, -50, -250);
    nebula2.lookAt(0, 0, 0);
    this.scene.add(nebula2);
  }

  // 2. Create the main neon grid floor platform
  createFloorGrid() {
    const halfSize = this.platformSize / 2;

    const floorGeo = new THREE.BoxGeometry(this.platformSize, 0.4, this.platformSize);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x05070a,
      roughness: 0.8,
      metalness: 0.9
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.2;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(this.platformSize, 40, 0x00f0ff, 0x004455);
    grid.position.y = 0.01;
    this.scene.add(grid);

    const borderGeo = new THREE.BufferGeometry();
    const borderPositions = new Float32Array([
      -halfSize, 0.02, -halfSize,
       halfSize, 0.02, -halfSize,
       halfSize, 0.02,  halfSize,
      -halfSize, 0.02,  halfSize,
      -halfSize, 0.02, -halfSize
    ]);
    borderGeo.setAttribute('position', new THREE.BufferAttribute(borderPositions, 3));
    const borderMat = new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 2 });
    const border = new THREE.Line(borderGeo, borderMat);
    this.scene.add(border);
  }

  // 3. Create monolithic towers (and record colliders)
  createMonoliths(positions) {
    positions.forEach((pos) => {
      const towerGeo = new THREE.CylinderGeometry(pos.r * 0.7, pos.r, pos.h, 6);
      const towerMat = new THREE.MeshStandardMaterial({
        color: 0x11161d,
        roughness: 0.15,
        metalness: 0.95,
        flatShading: true
      });
      
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.set(pos.x, pos.h / 2, pos.z);
      this.scene.add(tower);
      this.monolithMeshes.push(tower);

      const ringCount = Math.floor(pos.h / 6);
      for (let j = 1; j <= ringCount; j++) {
        const ringY = j * 5;
        const ringGeo = new THREE.TorusGeometry(pos.r * 0.85, 0.1, 8, 24);
        const ringMat = new THREE.MeshStandardMaterial({
          color: 0x00f0ff,
          emissive: 0x00f0ff,
          emissiveIntensity: 1.5,
          roughness: 0.2
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(pos.x, ringY, pos.z);
        this.scene.add(ring);
        this.monolithMeshes.push(ring);
      }

      this.colliders.push({
        position: new THREE.Vector3(pos.x, 0, pos.z),
        radius: pos.r
      });
    });
  }

  // 4. Create floating platforms
  createPlatform(x, y, z, width, height, depth, color = 0x00f0ff, movingParams = null, isFading = false) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshStandardMaterial({
      color: isFading ? 0x1d111d : 0x090a10,
      roughness: 0.25,
      metalness: 0.85,
      transparent: true,
      opacity: 0.9
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + height / 2, z);
    this.scene.add(mesh);

    // Neon borders
    const edges = new THREE.EdgesGeometry(geo);
    const lineMat = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
    const edgeLines = new THREE.LineSegments(edges, lineMat);
    mesh.add(edgeLines);

    const platform = {
      mesh,
      edgeLines,
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - depth / 2,
      maxZ: z + depth / 2,
      y: y + height,
      isMoving: !!movingParams,
      color,
      width,
      depth,
      height
    };

    if (isFading) {
      platform.isFadingPlatform = true;
      platform.fadeState = 'idle'; // 'idle', 'fading', 'collapsed'
      platform.fadeTimer = 0.0;
      platform.regenTimer = 0.0;
      platform.originalY = platform.y;
      platform.originalMeshY = mesh.position.y;
      platform.edgeLines = edgeLines;
    }

    if (movingParams) {
      platform.startPos = new THREE.Vector3(x, y + height / 2, z);
      platform.endPos = new THREE.Vector3(movingParams.targetX, movingParams.targetY + height / 2, movingParams.targetZ);
      platform.speed = movingParams.speed || 1.2;
      platform.direction = 1;
      platform.t = 0;
      platform.displacement = new THREE.Vector3();
      platform.previousPos = platform.startPos.clone();
    }

    this.platforms.push(platform);
  }

  // 5. Create portal pads
  createPortal(x, y, z, color = 0x00f0ff) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Base pad cylinder
    const padGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.15, 16);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x181e2b,
      roughness: 0.3,
      metalness: 0.8
    });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    group.add(padMesh);

    // Colored glowing ring
    const ringGeo = new THREE.TorusGeometry(1.1, 0.06, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 1.5
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.08;
    group.add(ringMesh);

    // Warping light cylinder
    const beamGeo = new THREE.CylinderGeometry(0.8, 0.8, 1.8, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.position.y = 0.9;
    group.add(beamMesh);

    this.scene.add(group);

    const portal = {
      id: `portal_${this.portals.length}`,
      mesh: group,
      position: new THREE.Vector3(x, y + 0.1, z),
      targetPortalId: null,
      color,
      ringMesh,
      beamMesh
    };

    this.portals.push(portal);
    return portal;
  }

  // 6. Create cyclic lasers
  createLaser(x1, z1, x2, z2, y, activeTime = 2.2, inactiveTime = 1.8) {
    const p1 = new THREE.Vector3(x1, y, z1);
    const p2 = new THREE.Vector3(x2, y, z2);

    // End posts columns
    const postGeo = new THREE.CylinderGeometry(0.18, 0.18, 3.5, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x1f2630, metalness: 0.9, roughness: 0.3 });
    
    const post1 = new THREE.Mesh(postGeo, postMat);
    post1.position.set(x1, y + 1.75, z1);
    const post2 = new THREE.Mesh(postGeo, postMat);
    post2.position.set(x2, y + 1.75, z2);
    
    this.scene.add(post1);
    this.scene.add(post2);

    // Laser cylinder beam
    const distance = p1.distanceTo(p2);
    const beamGeo = new THREE.CylinderGeometry(0.06, 0.06, distance, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xff0044,
      transparent: true,
      opacity: 0.85
    });

    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    beamMesh.position.copy(midPoint);
    beamMesh.position.y += 1.2; // Placed at waist height

    // Orient cylinder segment between posts
    const direction = new THREE.Vector3().subVectors(p2, p1);
    const alignAxis = new THREE.Vector3(0, 1, 0);
    beamMesh.quaternion.setFromUnitVectors(alignAxis, direction.clone().normalize());

    this.scene.add(beamMesh);

    this.lasers.push({
      mesh: beamMesh,
      posts: [post1, post2],
      isActive: true,
      timer: 0,
      activeTime,
      inactiveTime,
      p1: new THREE.Vector3(x1, y + 1.2, z1),
      p2: new THREE.Vector3(x2, y + 1.2, z2),
      length: distance,
      beamMat
    });
  }

  // 7. Create AI Guard (now with health parameters and billboarded life bar + % text)
  createGuard(patrolPoints, speed = 4.0, maxHealth = 2) {
    const finalMaxHealth = typeof maxHealth === 'number' && !isNaN(maxHealth) ? maxHealth : 2;
    const group = new THREE.Group();
    group.position.copy(patrolPoints[0]);
    group.position.y += 1.3; // Hover altitude

    // Inner glowing core
    const coreGeo = new THREE.OctahedronGeometry(0.48, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xff2200,
      emissive: 0xff2200,
      emissiveIntensity: 1.5,
      roughness: 0.1,
      metalness: 0.9
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // Outer wireframe shell
    const outerGeo = new THREE.OctahedronGeometry(0.8, 0);
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.7
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    group.add(outerMesh);

    // 3D Floating Health Bar billboard group
    const healthBarGroup = new THREE.Group();
    healthBarGroup.position.set(0, 1.3, 0); // Position above drone

    // Health bar background plane (Red/Dark)
    const bgGeo = new THREE.PlaneGeometry(1.2, 0.14);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x330000, side: THREE.DoubleSide });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    healthBarGroup.add(bgMesh);

    // Health bar foreground plane (Green)
    const fgGeo = new THREE.PlaneGeometry(1.2, 0.14);
    const fgMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
    const fgMesh = new THREE.Mesh(fgGeo, fgMat);
    fgMesh.position.z = 0.01; // Avoid z-fighting
    healthBarGroup.add(fgMesh);

    // 3D health percentage canvas label texture
    const textCanvas = document.createElement('canvas');
    textCanvas.width = 64;
    textCanvas.height = 32;
    const textCtx = textCanvas.getContext('2d');
    textCtx.font = 'bold 20px "Courier New", monospace';
    textCtx.fillStyle = '#ffffff';
    textCtx.textAlign = 'center';
    textCtx.textBaseline = 'middle';
    textCtx.fillText('100%', 32, 16);

    const textTexture = new THREE.CanvasTexture(textCanvas);
    const textMat = new THREE.MeshBasicMaterial({ map: textTexture, transparent: true, side: THREE.DoubleSide });
    const textGeo = new THREE.PlaneGeometry(0.5, 0.25);
    const textMesh = new THREE.Mesh(textGeo, textMat);
    textMesh.position.set(0.95, 0, 0.01);
    healthBarGroup.add(textMesh);

    group.add(healthBarGroup);

    this.scene.add(group);

    this.guards.push({
      mesh: group,
      coreMesh,
      outerMesh,
      patrolNodes: patrolPoints.map(p => new THREE.Vector3(p.x, p.y + 1.3, p.z)),
      currentNodeIdx: 0,
      isAlert: false,
      targetPlayer: null,
      speed,
      patrolSpeed: speed,
      chaseSpeed: speed * 1.85,
      
      // Health properties
      health: finalMaxHealth,
      maxHealth: finalMaxHealth,
      healthBarGroup,
      healthBarFg: fgMesh,
      healthTextCanvas: textCanvas,
      healthTextCtx: textCtx,
      healthTextTexture: textTexture
    });
  }

  // Helper: Spawn rotating neon-yellow ammo crate
  createAmmoMesh(x, y, z, id) {
    const ammoGroup = new THREE.Group();
    ammoGroup.position.set(x, y, z);

    // Outer cage box (wireframe neon yellow)
    const cageGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const cageMat = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 1.2,
      wireframe: true
    });
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    ammoGroup.add(cageMesh);

    // Inner capsule (bright orange-yellow)
    const capGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.38, 8);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xffaa00,
      emissiveIntensity: 1.8,
      roughness: 0.1,
      metalness: 0.8
    });
    const capMesh = new THREE.Mesh(capGeo, capMat);
    capMesh.rotation.x = Math.PI / 2;
    ammoGroup.add(capMesh);

    this.scene.add(ammoGroup);

    this.ammoPacks.push({
      id,
      mesh: ammoGroup,
      basePosition: new THREE.Vector3(x, y, z),
      bobOffset: Math.random() * Math.PI * 2
    });
  }

  // 8. Create interactive switch for Sector 7
  createSwitch(x, y, z, id, targetId) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Pedestal base
    const baseGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.8, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.4, metalness: 0.8 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.4;
    group.add(baseMesh);

    // Glowing switch core (Octahedron)
    const switchGeo = new THREE.OctahedronGeometry(0.24, 0);
    const switchMat = new THREE.MeshStandardMaterial({
      color: 0xff0033,
      emissive: 0xff0033,
      emissiveIntensity: 1.8,
      roughness: 0.1,
      metalness: 0.9
    });
    const switchMesh = new THREE.Mesh(switchGeo, switchMat);
    switchMesh.position.set(0, 0.95, 0);
    group.add(switchMesh);

    this.scene.add(group);

    this.switches.push({
      id,
      targetId,
      isActive: false,
      mesh: group,
      switchMesh: switchMesh
    });
  }

  // 9. Create phase platform for Sector 7
  createPhasePlatform(x, y, z, width, height, depth, color = 0x00f0ff, id) {
    this.createPlatform(x, y, z, width, height, depth, color);
    const p = this.platforms[this.platforms.length - 1];
    p.isPhasePlatform = true;
    p.phaseId = id;
    p.isActive = false; // Starts inactive/invisible
    p.mesh.visible = false;
    p.minX = 99999;
    p.maxX = 99999;
    p.minZ = 99999;
    p.maxZ = 99999;
    p.originalColor = color;
  }

  // 10. Create low-gravity inversion fields for Sector 8
  createGravityField(x, y, z, width, height, depth) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x9900ff,
      transparent: true,
      opacity: 0.1,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + height / 2, z);
    this.scene.add(mesh);

    // Glowing purple wireframe outline
    const edges = new THREE.EdgesGeometry(geo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xbd00ff, linewidth: 1 });
    const edgeLines = new THREE.LineSegments(edges, lineMat);
    mesh.add(edgeLines);

    // Particle emitter setup for gravity field
    const particlesGroup = new THREE.Group();
    const partGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const partMat = new THREE.MeshBasicMaterial({ color: 0xbd00ff, transparent: true, opacity: 0.7 });
    const localParts = [];
    
    for (let i = 0; i < 12; i++) {
      const pMesh = new THREE.Mesh(partGeo, partMat);
      const px = (Math.random() - 0.5) * (width - 0.5);
      const py = (Math.random() - 0.5) * (height - 0.5);
      const pz = (Math.random() - 0.5) * (depth - 0.5);
      pMesh.position.set(px, py, pz);
      particlesGroup.add(pMesh);
      localParts.push({
        mesh: pMesh,
        speed: 1.0 + Math.random() * 1.5,
        startY: -height / 2,
        endY: height / 2
      });
    }
    mesh.add(particlesGroup);

    this.gravityFields.push({
      mesh,
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - depth / 2,
      maxZ: z + depth / 2,
      minY: y,
      maxY: y + height,
      particles: localParts,
      particlesGroup
    });
  }

  // 11. Create destructible force barriers for Sector 8
  createBarrier(x, y, z, width, height, depth, color = 0xff00cc) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + height / 2, z);
    this.scene.add(mesh);

    // Glowing border outline
    const edges = new THREE.EdgesGeometry(geo);
    const lineMat = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
    const edgeLines = new THREE.LineSegments(edges, lineMat);
    mesh.add(edgeLines);

    this.barriers.push({
      mesh,
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - depth / 2,
      maxZ: z + depth / 2,
      minY: y,
      maxY: y + height,
      health: 3,
      maxHealth: 3
    });
  }

  // 12. Create speed boost rings for Sector 9
  createBoostRing(x, y, z, rx, ry, rz, radius = 2.4) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.set(rx, ry, rz);

    // Neon booster ring (Torus)
    const ringGeo = new THREE.TorusGeometry(radius, 0.16, 8, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffee00,
      emissive: 0xffee00,
      emissiveIntensity: 2.0,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    group.add(ringMesh);

    // Pulse core overlay indicators (arrows pointing forward)
    const arrowGeo = new THREE.ConeGeometry(0.25, 0.5, 4);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffee00, transparent: true, opacity: 0.8 });
    
    // Add 4 arrows around the ring pointing in local Z forward direction
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const arrow = new THREE.Mesh(arrowGeo, arrowMat);
      arrow.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      arrow.rotation.x = Math.PI / 2; // Point forward along local Z
      arrow.rotation.z = -angle;
      group.add(arrow);
    }

    this.scene.add(group);

    // Calculate local Z direction vector in world space
    const dirVec = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(rx, ry, rz)).normalize();

    this.boostRings.push({
      mesh: group,
      position: new THREE.Vector3(x, y, z),
      direction: dirVec,
      radius: radius
    });
  }

  // 13. Create Boss Overseer for Sector 9
  createBossOverseer(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Core body (Large Octahedron)
    const coreGeo = new THREE.OctahedronGeometry(1.6, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xff0066,
      emissive: 0xff0066,
      emissiveIntensity: 1.8,
      roughness: 0.1,
      metalness: 0.9
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // Outer wireframe shell
    const outerGeo = new THREE.OctahedronGeometry(2.6, 0);
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.6
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    group.add(outerMesh);

    // Shield mesh rings rotating around core
    const shieldGroup = new THREE.Group();
    
    // Create Curved protective shield plates
    const shieldGeo = new THREE.TorusGeometry(3.0, 0.25, 8, 16, Math.PI * 0.45);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.5,
      side: THREE.DoubleSide
    });

    const shield1 = new THREE.Mesh(shieldGeo, shieldMat);
    shield1.rotation.x = Math.PI / 2;
    shieldGroup.add(shield1);

    const shield2 = new THREE.Mesh(shieldGeo, shieldMat);
    shield2.rotation.x = Math.PI / 2;
    shield2.rotation.z = Math.PI * 0.8;
    shieldGroup.add(shield2);

    group.add(shieldGroup);

    // Billboard health bar above boss
    const healthBarGroup = new THREE.Group();
    healthBarGroup.position.set(0, 3.8, 0);

    const bgGeo = new THREE.PlaneGeometry(3.0, 0.25);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x330000, side: THREE.DoubleSide });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    healthBarGroup.add(bgMesh);

    const fgGeo = new THREE.PlaneGeometry(3.0, 0.25);
    const fgMat = new THREE.MeshBasicMaterial({ color: 0xff0066, side: THREE.DoubleSide });
    const fgMesh = new THREE.Mesh(fgGeo, fgMat);
    fgMesh.position.z = 0.01;
    healthBarGroup.add(fgMesh);

    // 3D health text canvas
    const textCanvas = document.createElement('canvas');
    textCanvas.width = 128;
    textCanvas.height = 48;
    const textCtx = textCanvas.getContext('2d');
    textCtx.font = 'bold 24px "Courier New", monospace';
    textCtx.fillStyle = '#ffffff';
    textCtx.textAlign = 'center';
    textCtx.textBaseline = 'middle';
    textCtx.fillText('100%', 64, 24);

    const textTexture = new THREE.CanvasTexture(textCanvas);
    const textMat = new THREE.MeshBasicMaterial({ map: textTexture, transparent: true, side: THREE.DoubleSide });
    const textGeo = new THREE.PlaneGeometry(1.2, 0.45);
    const textMesh = new THREE.Mesh(textGeo, textMat);
    textMesh.position.set(2.2, 0, 0.01);
    healthBarGroup.add(textMesh);

    group.add(healthBarGroup);

    this.scene.add(group);

    this.bossOverseer = {
      mesh: group,
      coreMesh,
      outerMesh,
      shieldMesh: shieldGroup,
      health: 6,
      maxHealth: 6,
      healthBarGroup,
      healthBarFg: fgMesh,
      healthTextCanvas: textCanvas,
      healthTextCtx: textCtx,
      healthTextTexture: textTexture,
      projectiles: [],
      shootCooldown: 1.8,
      shieldSpeed: 2.0,
      damageIntensity: 0.0
    };
  }

  // Ammo coordinate layouts for Sectors 1-6
  spawnAmmoPacks(levelNumber) {
    if (levelNumber === 1) {
      this.createAmmoMesh(-12, 1.2, -12, 'ammo_1_1');
      this.createAmmoMesh(12, 1.2, 12, 'ammo_1_2');
      this.createAmmoMesh(0, 1.2, -16, 'ammo_1_3');
      this.createAmmoMesh(16, 1.2, -16, 'ammo_1_4');
      this.createAmmoMesh(-16, 1.2, 16, 'ammo_1_5');
    } else if (levelNumber === 2) {
      this.createAmmoMesh(-15, 9.2, -5, 'ammo_2_1');
      this.createAmmoMesh(15, 9.2, 5, 'ammo_2_2');
      this.createAmmoMesh(0, 1.2, -8, 'ammo_2_3');
      this.createAmmoMesh(0, 5.2, 14, 'ammo_2_4');
      this.createAmmoMesh(0, 12.2, -14, 'ammo_2_5');
    } else if (levelNumber === 3) {
      this.createAmmoMesh(-16, 5.2, -14, 'ammo_3_1');
      this.createAmmoMesh(16, 5.2, -14, 'ammo_3_2');
      this.createAmmoMesh(-16, 9.2, 14, 'ammo_3_3');
      this.createAmmoMesh(16, 9.2, 14, 'ammo_3_4');
      this.createAmmoMesh(0, 12.2, 0, 'ammo_3_5');
      this.createAmmoMesh(0, 1.2, -25, 'ammo_3_6');
    } else if (levelNumber === 4) {
      this.createAmmoMesh(-18, 7.2, 6, 'ammo_4_1');
      this.createAmmoMesh(18, 7.2, 6, 'ammo_4_2');
      this.createAmmoMesh(0, 11.2, -2, 'ammo_4_3');
      this.createAmmoMesh(0, 11.2, 4, 'ammo_4_4');
      this.createAmmoMesh(0, 6.2, -16, 'ammo_4_5');
      this.createAmmoMesh(0, 1.2, 20, 'ammo_4_6');
    } else if (levelNumber === 5) {
      this.createAmmoMesh(-20, 7.2, -18, 'ammo_5_1');
      this.createAmmoMesh(20, 7.2, -18, 'ammo_5_2');
      this.createAmmoMesh(-20, 12.2, 18, 'ammo_5_3');
      this.createAmmoMesh(20, 12.2, 18, 'ammo_5_4');
      this.createAmmoMesh(0, 1.2, 0, 'ammo_5_5');
      this.createAmmoMesh(0, 1.2, -28, 'ammo_5_6');
      this.createAmmoMesh(0, 1.2, 20, 'ammo_5_7');
    } else if (levelNumber === 6) {
      this.createAmmoMesh(0, 4.2, 22, 'ammo_6_1');
      this.createAmmoMesh(0, 12.2, -22, 'ammo_6_2');
      this.createAmmoMesh(0, 6.2, 12, 'ammo_6_3');
      this.createAmmoMesh(-8, 8.2, 3, 'ammo_6_4');
      this.createAmmoMesh(8, 8.2, 3, 'ammo_6_5');
      this.createAmmoMesh(0, 10.2, -10, 'ammo_6_6');
    } else if (levelNumber === 7) {
      this.createAmmoMesh(0, 5.2, 26, 'ammo_7_1');
      this.createAmmoMesh(-18, 7.2, 10, 'ammo_7_2');
      this.createAmmoMesh(18, 9.2, -10, 'ammo_7_3');
      this.createAmmoMesh(0, 12.2, -32, 'ammo_7_4');
      this.createAmmoMesh(0, 1.2, 0, 'ammo_7_5');
    } else if (levelNumber === 8) {
      this.createAmmoMesh(0, 4.2, 26, 'ammo_8_1');
      this.createAmmoMesh(-15, 5.2, 10, 'ammo_8_2');
      this.createAmmoMesh(0, 23.2, 0, 'ammo_8_3');
      this.createAmmoMesh(15, 13.2, -10, 'ammo_8_4');
      this.createAmmoMesh(0, 15.2, -28, 'ammo_8_5');
      this.createAmmoMesh(0, 1.2, -10, 'ammo_8_6');
    } else if (levelNumber === 9) {
      this.createAmmoMesh(0, 5.2, 30, 'ammo_9_1');
      this.createAmmoMesh(0, 11.2, -18, 'ammo_9_2');
      this.createAmmoMesh(0, 11.2, -30, 'ammo_9_3');
      this.createAmmoMesh(-6, 11.2, -30, 'ammo_9_4');
      this.createAmmoMesh(6, 11.2, -30, 'ammo_9_5');
      this.createAmmoMesh(0, 1.2, 0, 'ammo_9_6');
    }
  }

  // Helper: Spawn crystal mesh
  createCrystalMesh(x, y, z, id, isAttachedPlatform = null) {
    const crystalGroup = new THREE.Group();
    crystalGroup.position.set(x, y, z);

    // Holographic outer hull
    const hullGeo = new THREE.OctahedronGeometry(0.65, 0);
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.0,
      wireframe: true
    });
    const hullMesh = new THREE.Mesh(hullGeo, hullMat);
    crystalGroup.add(hullMesh);

    // Glow core
    const coreGeo = new THREE.OctahedronGeometry(0.35, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xff00b4,
      emissive: 0xff00b4,
      emissiveIntensity: 2.0,
      roughness: 0.1,
      metalness: 0.8
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    crystalGroup.add(coreMesh);

    this.scene.add(crystalGroup);

    this.crystals.push({
      id,
      mesh: crystalGroup,
      coreMesh,
      hullMesh,
      basePosition: new THREE.Vector3(x, y, z),
      bobOffset: Math.random() * Math.PI * 2,
      isAttachedPlatform
    });
  }

  // LEVEL 1: Random spawn coords (no platforms)
  spawnCrystalsLevel1(count) {
    const halfSize = this.platformSize / 2 - 4;
    for (let i = 0; i < count; i++) {
      let x, z, isValid = false;

      while (!isValid) {
        x = (Math.random() * 2 - 1) * halfSize;
        z = (Math.random() * 2 - 1) * halfSize;

        if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;

        isValid = true;
        for (const collider of this.colliders) {
          const dx = x - collider.position.x;
          const dz = z - collider.position.z;
          if (Math.sqrt(dx * dx + dz * dz) < collider.radius + 3.0) {
            isValid = false;
            break;
          }
        }
      }
      this.createCrystalMesh(x, 1.2, z, `crystal_${i}`);
    }
  }

  // LEVEL 2: Dedicated spots on floor, static and moving platforms
  spawnCrystalsLevel2() {
    const floorPositions = [
      { x: 12, z: 12 }, { x: -12, z: -12 },
      { x: -24, z: 20 }, { x: 24, z: -20 },
      { x: 0, z: 30 }, { x: -28, z: -28 }
    ];

    floorPositions.forEach((pos, idx) => {
      this.createCrystalMesh(pos.x, 1.2, pos.z, `crystal_f_${idx}`);
    });

    // Static platforms
    this.createCrystalMesh(0, 5.2, 14, 'crystal_pA');      // Platform A
    this.createCrystalMesh(-15, 9.2, 0, 'crystal_pB1');    // Platform B
    this.createCrystalMesh(-15, 9.2, 3, 'crystal_pB2');
    this.createCrystalMesh(15, 9.2, 0, 'crystal_pC1');     // Platform C
    this.createCrystalMesh(15, 9.2, -3, 'crystal_pC2');
    this.createCrystalMesh(0, 12.2, -14, 'crystal_pD1');   // Platform D
    this.createCrystalMesh(3, 12.2, -14, 'crystal_pD2');

    // Crystal floating on Moving Platform 2
    this.createCrystalMesh(-12, 9.2, -6, 'crystal_moving_p2', 4); // Index 4 is moving platform 2
  }

  // LEVEL 3: Core spots, portal paths, and central high platform
  spawnCrystalsLevel3() {
    // Floor
    const floorSpots = [
      { x: 0, z: 15 }, { x: 0, z: -25 },
      { x: -28, z: 0 }, { x: 28, z: 0 }
    ];
    floorSpots.forEach((pos, idx) => {
      this.createCrystalMesh(pos.x, 1.2, pos.z, `crystal_f3_${idx}`);
    });

    // Platform 1 (Low corner)
    this.createCrystalMesh(-16, 5.2, -16, 'crystal_3_p1_a');
    this.createCrystalMesh(-14, 5.2, -18, 'crystal_3_p1_b');

    // Platform 2 (Low corner)
    this.createCrystalMesh(16, 5.2, -16, 'crystal_3_p2_a');
    this.createCrystalMesh(14, 5.2, -18, 'crystal_3_p2_b');

    // Platform 3 (Mid corner)
    this.createCrystalMesh(-16, 9.2, 16, 'crystal_3_p3_a');
    this.createCrystalMesh(-18, 9.2, 14, 'crystal_3_p3_b');

    // Platform 4 (Mid corner)
    this.createCrystalMesh(16, 9.2, 16, 'crystal_3_p4_a');
    this.createCrystalMesh(18, 9.2, 14, 'crystal_3_p4_b');

    // Platform 5 (Central High y=11)
    this.createCrystalMesh(0, 12.2, 0, 'crystal_3_p5_a');
    this.createCrystalMesh(3, 12.2, 3, 'crystal_3_p5_b');
    this.createCrystalMesh(-3, 12.2, -3, 'crystal_3_p5_c');
  }

  // Main tick loop updates for animating elements
  update(time, delta) {
    // 1. Crystals rotation, bobbing, and attachment displacement
    this.crystals.forEach((c) => {
      c.coreMesh.rotation.y += 0.8 * delta;
      c.coreMesh.rotation.x += 0.4 * delta;

      c.hullMesh.rotation.y -= 0.5 * delta;
      c.hullMesh.rotation.z += 0.3 * delta;

      // Bobbing floating animation
      const bobDistance = 0.18;
      const bobSpeed = 2.2;
      const bobY = Math.sin(time * bobSpeed + c.bobOffset) * bobDistance;

      if (c.isAttachedPlatform !== null && c.isAttachedPlatform !== undefined) {
        const plat = this.platforms[c.isAttachedPlatform];
        if (plat) {
          c.basePosition.copy(plat.mesh.position);
          c.basePosition.y += 1.2; // Offset height
        }
      }
      c.mesh.position.copy(c.basePosition);
      c.mesh.position.y += bobY;
    });

    // Bob and rotate ammo packs
    this.ammoPacks.forEach(a => {
      a.mesh.rotation.y += 0.8 * delta;
      a.mesh.rotation.x += 0.4 * delta;

      const bobDistance = 0.15;
      const bobSpeed = 2.5;
      const bobY = Math.sin(time * bobSpeed + a.bobOffset) * bobDistance;

      a.mesh.position.copy(a.basePosition);
      a.mesh.position.y += bobY;
    });

    // 2. Animate Moving Platforms and calculate displacement
    this.platforms.forEach(p => {
      if (p.isMoving) {
        p.t += p.speed * delta * 0.15 * p.direction;
        if (p.t >= 1.0) {
          p.t = 1.0;
          p.direction = -1;
        } else if (p.t <= 0.0) {
          p.t = 0.0;
          p.direction = 1;
        }
        
        const currentPos = new THREE.Vector3().lerpVectors(p.startPos, p.endPos, p.t);
        p.mesh.position.copy(currentPos);
        
        // Calculate displacement for syncing player velocity attachment
        p.displacement.copy(currentPos).sub(p.previousPos);
        p.previousPos.copy(currentPos);

        // Update bounds
        p.minX = currentPos.x - p.width / 2;
        p.maxX = currentPos.x + p.width / 2;
        p.minZ = currentPos.z - p.depth / 2;
        p.maxZ = currentPos.z + p.depth / 2;
        p.y = currentPos.y + p.height / 2;
      }
    });

    // 3. Update cyclic lasers active states
    this.lasers.forEach(l => {
      l.timer += delta;
      if (l.isActive) {
        if (l.timer >= l.activeTime) {
          l.isActive = false;
          l.timer = 0;
          l.beamMat.opacity = 0.04; 
        }
      } else {
        if (l.timer >= l.inactiveTime) {
          l.isActive = true;
          l.timer = 0;
          l.beamMat.opacity = 0.85; 
        }
      }

      if (l.isActive) {
        l.beamMat.opacity = 0.72 + Math.sin(time * 25.0) * 0.12;
      }
    });

    // 4. Update Portal beam rotations
    this.portals.forEach(port => {
      port.beamMesh.rotation.y += 0.8 * delta;
    });

    // 5. Update AI Guards patrol logic and chase actions
    for (let i = this.guards.length - 1; i >= 0; i--) {
      const g = this.guards[i];

      // Handle evaporation animation sequence
      if (g.isEvaporating) {
        g.evaporateTimer -= delta;

        // Spin extremely fast
        g.mesh.rotation.y += 24.0 * delta;

        // Ascend vertically
        g.mesh.position.y += 4.5 * delta;

        // Shrink drone mesh scale
        g.mesh.scale.x = Math.max(0, g.mesh.scale.x - 2.0 * delta);
        g.mesh.scale.y = Math.max(0, g.mesh.scale.y - 2.0 * delta);
        g.mesh.scale.z = Math.max(0, g.mesh.scale.z - 2.0 * delta);

        if (g.healthBarGroup) {
          g.healthBarGroup.scale.copy(g.mesh.scale);
        }

        if (g.evaporateTimer <= 0) {
          this.scene.remove(g.mesh);
          this.guards.splice(i, 1);
        }
        continue;
      }

      g.coreMesh.rotation.y += 1.4 * delta;
      g.coreMesh.rotation.x += 0.6 * delta;

      g.outerMesh.rotation.y -= (g.isAlert ? 4.8 : 0.8) * delta;
      g.outerMesh.rotation.z += (g.isAlert ? 2.8 : 0.4) * delta;

      let targetPos;
      if (g.isAlert && g.targetPlayer) {
        targetPos = new THREE.Vector3(g.targetPlayer.x, g.mesh.position.y, g.targetPlayer.z);
        g.speed = g.chaseSpeed;
        
        const flash = Math.sin(time * 18.0) > 0;
        g.coreMesh.material.color.setHex(flash ? 0xff0000 : 0xff7700);
        g.coreMesh.material.emissive.setHex(flash ? 0xff0000 : 0xff7700);
      } else {
        targetPos = g.patrolNodes[g.currentNodeIdx];
        g.speed = g.patrolSpeed;
        
        g.coreMesh.material.color.setHex(0xff2200);
        g.coreMesh.material.emissive.setHex(0xff2200);
      }

      const dir = new THREE.Vector3().subVectors(targetPos, g.mesh.position);
      const dist = dir.length();
      
      if (dist < 0.15 && !g.isAlert) {
        g.currentNodeIdx = (g.currentNodeIdx + 1) % g.patrolNodes.length;
      } else if (dist > 0.01) {
        dir.normalize();
        g.mesh.position.addScaledVector(dir, g.speed * delta);
      }

      // Decay hit flash & recover squashed scale
      if (g.coreMesh.material.emissiveIntensity > 1.5) {
        g.coreMesh.material.emissiveIntensity = Math.max(1.5, g.coreMesh.material.emissiveIntensity - 12.0 * delta);
      }
      g.mesh.scale.x += (1.0 - g.mesh.scale.x) * 8.0 * delta;
      g.mesh.scale.y += (1.0 - g.mesh.scale.y) * 8.0 * delta;
      g.mesh.scale.z += (1.0 - g.mesh.scale.z) * 8.0 * delta;
    }

    // 6. Update Gravity Lift inner rings rising animation
    this.gravityLifts.forEach(lift => {
      lift.innerRings.forEach(ring => {
        ring.position.y += delta * 2.8;
        if (ring.position.y > lift.endY) {
          ring.position.y = lift.startY;
        }
        const pct = (ring.position.y - lift.startY) / lift.height;
        ring.material.opacity = Math.sin(pct * Math.PI) * 0.4;
      });
    });

    // 7. Update Searchlight sweep rotation
    this.searchlights.forEach(light => {
      const isAlarm = this.isAlarmActive;
      const targetColor = isAlarm ? 0xff0000 : 0xff0055;
      
      light.mesh.material.color.setHex(targetColor);
      light.lightSpotMesh.material.color.setHex(targetColor);

      light.angle += delta * light.speed;
      light.target.x = light.origin.x + Math.cos(light.angle) * light.sweepRadius;
      light.target.z = light.origin.z + Math.sin(light.angle) * light.sweepRadius;

      light.lightSpotMesh.position.copy(light.target);

      const dir = new THREE.Vector3().subVectors(light.target, light.origin);
      light.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
    });

    // 8. Update Sweepers rotation
    this.sweepers.forEach(sw => {
      sw.mesh.rotation.y += delta * sw.speed;
      sw.angle = sw.mesh.rotation.y;
    });

    // 9. Update Fading Platforms
    this.platforms.forEach(p => {
      if (p.isFadingPlatform) {
        if (p.fadeState === 'fading') {
          p.fadeTimer -= delta;
          
          const blink = Math.sin(time * 30.0) > 0;
          p.edgeLines.material.color.setHex(blink ? 0xff0055 : 0xff00ff);
          p.mesh.position.x = (p.minX + p.width/2) + Math.sin(time * 80.0) * 0.05;
          
          if (p.fadeTimer <= 0) {
            p.fadeState = 'collapsed';
            p.mesh.visible = false;
            p.regenTimer = 4.0;
          }
        } else if (p.fadeState === 'collapsed') {
          p.regenTimer -= delta;
          if (p.regenTimer <= 0) {
            p.fadeState = 'idle';
            p.mesh.visible = true;
            p.mesh.position.x = p.minX + p.width / 2;
            p.edgeLines.material.color.setHex(p.color);
          }
        }
      }
    });

    // 10. Update Sector 7 Switches
    this.switches.forEach(s => {
      s.switchMesh.rotation.y += 0.8 * delta;
    });

    // 11. Update Sector 8 Gravity Inversion Field Particles
    this.gravityFields.forEach(f => {
      f.particles.forEach(p => {
        p.mesh.position.y += p.speed * delta;
        if (p.mesh.position.y > p.endY) {
          p.mesh.position.y = p.startY;
        }
      });
    });

    // 12. Update Sector 9 Boss Overseer
    if (this.bossOverseer) {
      const boss = this.bossOverseer;
      boss.coreMesh.rotation.y += 1.2 * delta;
      boss.coreMesh.rotation.x += 0.6 * delta;
      boss.outerMesh.rotation.y -= 0.5 * delta;
      boss.outerMesh.rotation.z += 0.3 * delta;

      boss.shieldMesh.rotation.y += boss.shieldSpeed * delta;

      if (boss.damageIntensity > 0) {
        boss.damageIntensity -= 8.0 * delta;
        boss.coreMesh.material.emissiveIntensity = 1.8 + Math.max(0, boss.damageIntensity) * 4.2;
        const wobble = 1.0 + Math.sin(time * 60.0) * 0.08 * boss.damageIntensity;
        const squash = 1.0 - Math.sin(time * 60.0) * 0.08 * boss.damageIntensity;
        boss.mesh.scale.set(wobble, squash, wobble);
      } else {
        boss.mesh.scale.set(1.0, 1.0, 1.0);
        boss.coreMesh.material.emissiveIntensity = 1.8;
      }
    }
  }

  removeCrystal(crystalId) {
    const index = this.crystals.findIndex((c) => c.id === crystalId);
    if (index !== -1) {
      const crystal = this.crystals[index];
      this.scene.remove(crystal.mesh);
      this.crystals.splice(index, 1);
    }
  }

  // 10. Core Custom Geometry Builders for Sectors 4-6
  createGravityLift(x, y, z, radius = 2.5, height = 15) {
    const geo = new THREE.CylinderGeometry(radius, radius, height, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ff66,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const cylinder = new THREE.Mesh(geo, mat);
    cylinder.position.set(x, y + height / 2, z);
    this.scene.add(cylinder);

    const ringGeo = new THREE.TorusGeometry(radius, 0.08, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ff66,
      transparent: true,
      opacity: 0.8
    });
    const bottomRing = new THREE.Mesh(ringGeo, ringMat);
    bottomRing.rotation.x = Math.PI / 2;
    bottomRing.position.set(x, y + 0.05, z);
    this.scene.add(bottomRing);

    const topRing = new THREE.Mesh(ringGeo, ringMat);
    topRing.rotation.x = Math.PI / 2;
    topRing.position.set(x, y + height - 0.05, z);
    this.scene.add(topRing);

    this.monolithMeshes.push(bottomRing);
    this.monolithMeshes.push(topRing);

    const innerRings = [];
    const innerRingCount = 3;
    for (let i = 0; i < innerRingCount; i++) {
      const ir = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.95, 0.04, 4, 16), ringMat.clone());
      ir.rotation.x = Math.PI / 2;
      ir.position.set(x, y + (i / innerRingCount) * height, z);
      this.scene.add(ir);
      innerRings.push(ir);
      this.monolithMeshes.push(ir);
    }

    this.gravityLifts.push({
      mesh: cylinder,
      position: new THREE.Vector3(x, y, z),
      radius,
      height,
      innerRings,
      startY: y,
      endY: y + height
    });
  }

  createVelocityPad(x, y, z, width = 3, depth = 3, dirX, dirY, dirZ, force = 28) {
    const padGeo = new THREE.BoxGeometry(width, 0.08, depth);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x07151a,
      roughness: 0.4,
      metalness: 0.9
    });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.position.set(x, y + 0.04, z);
    this.scene.add(padMesh);

    const direction = new THREE.Vector3(dirX, dirY, dirZ).normalize();
    const arrowGeo = new THREE.ConeGeometry(0.4, 1.2, 4);
    const arrowMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      depthWrite: true
    });
    const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
    
    arrowMesh.position.set(x + direction.x * 0.5, y + 0.15, z + direction.z * 0.5);
    arrowMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    this.scene.add(arrowMesh);

    const edges = new THREE.EdgesGeometry(padGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, linewidth: 2 });
    const edgeLines = new THREE.LineSegments(edges, lineMat);
    padMesh.add(edgeLines);

    this.velocityPads.push({
      mesh: padMesh,
      arrowMesh,
      position: new THREE.Vector3(x, y, z),
      direction,
      force
    });
  }

  createSearchlight(x, y, z, sweepRadius = 8, speed = 1.5, radius = 3.5) {
    const beamLength = y - 0.2;
    const coneGeo = new THREE.CylinderGeometry(0.1, radius, beamLength, 16, 1, true);
    coneGeo.translate(0, -beamLength / 2, 0);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xff0055,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const beamMesh = new THREE.Mesh(coneGeo, coneMat);
    beamMesh.position.set(x, y, z);
    this.scene.add(beamMesh);

    const spotGeo = new THREE.RingGeometry(radius - 0.15, radius, 32);
    const spotMat = new THREE.MeshBasicMaterial({
      color: 0xff0055,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    const spotMesh = new THREE.Mesh(spotGeo, spotMat);
    spotMesh.rotation.x = Math.PI / 2;
    spotMesh.position.set(x, 0.05, z);
    this.scene.add(spotMesh);

    this.searchlights.push({
      mesh: beamMesh,
      lightSpotMesh: spotMesh,
      origin: new THREE.Vector3(x, y, z),
      target: new THREE.Vector3(x, 0, z),
      angle: Math.random() * Math.PI * 2,
      speed,
      sweepRadius,
      radius,
      beamLength
    });
  }

  createSweeper(x, y, z, length = 12, speed = 2.0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const coreGeo = new THREE.CylinderGeometry(0.4, 0.4, 3, 8);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x1c212b,
      metalness: 0.9,
      roughness: 0.2
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    const armGeo = new THREE.CylinderGeometry(0.1, 0.1, length, 8);
    armGeo.rotateZ(Math.PI / 2);
    armGeo.translate(length / 2, 0, 0);

    const armMat = new THREE.MeshBasicMaterial({
      color: 0xff0033,
      transparent: true,
      opacity: 0.8
    });
    const armMesh = new THREE.Mesh(armGeo, armMat);
    armMesh.position.set(0, 0.8, 0);
    group.add(armMesh);

    const armGeo2 = armGeo.clone().translate(-length, 0, 0);
    const armMesh2 = new THREE.Mesh(armGeo2, armMat);
    armMesh2.position.set(0, 0.8, 0);
    group.add(armMesh2);

    this.scene.add(group);

    this.sweepers.push({
      mesh: group,
      armMesh,
      armMesh2,
      center: new THREE.Vector3(x, y + 0.8, z),
      length,
      angle: 0.0,
      speed
    });
  }

  // 11. Crystal spawning layouts for Sectors 4-6
  spawnCrystalsLevel4() {
    const floorPositions = [
      { x: -28, z: 28 }, { x: 28, z: 28 },
      { x: -26, z: -26 }, { x: 26, z: -26 }
    ];
    floorPositions.forEach((pos, idx) => {
      this.createCrystalMesh(pos.x, 1.2, pos.z, `crystal_4_f_${idx}`);
    });

    this.createCrystalMesh(-18, 7.2, 8, 'crystal_4_pLeft_a');
    this.createCrystalMesh(-16, 7.2, 10, 'crystal_4_pLeft_b');
    this.createCrystalMesh(-20, 7.2, 6, 'crystal_4_pLeft_c');

    this.createCrystalMesh(18, 7.2, 8, 'crystal_4_pRight_a');
    this.createCrystalMesh(16, 7.2, 10, 'crystal_4_pRight_b');
    this.createCrystalMesh(20, 7.2, 6, 'crystal_4_pRight_c');

    this.createCrystalMesh(0, 6.2, -16, 'crystal_4_pBack');

    this.createCrystalMesh(0, 11.2, 0, 'crystal_4_pCenter_a');
    this.createCrystalMesh(2, 11.2, 2, 'crystal_4_pCenter_b');
    this.createCrystalMesh(-2, 11.2, -2, 'crystal_4_pCenter_c');
    this.createCrystalMesh(-2, 11.2, 2, 'crystal_4_pCenter_d');
    this.createCrystalMesh(2, 11.2, -2, 'crystal_4_pCenter_e');
  }

  spawnCrystalsLevel5() {
    const floorPositions = [
      { x: -30, z: -28 }, { x: 30, z: -28 },
      { x: -30, z: 28 }, { x: 30, z: 28 },
      { x: 0, z: -18 }, { x: 0, z: 18 }
    ];
    floorPositions.forEach((pos, idx) => {
      this.createCrystalMesh(pos.x, 1.2, pos.z, `crystal_5_f_${idx}`);
    });

    this.createCrystalMesh(-18, 7.2, -18, 'crystal_5_p1_a');
    this.createCrystalMesh(-16, 7.2, -20, 'crystal_5_p1_b');

    this.createCrystalMesh(18, 7.2, -18, 'crystal_5_p2_a');
    this.createCrystalMesh(16, 7.2, -20, 'crystal_5_p2_b');

    this.createCrystalMesh(-18, 12.2, 18, 'crystal_5_p3_a');
    this.createCrystalMesh(-20, 12.2, 16, 'crystal_5_p3_b');

    this.createCrystalMesh(18, 12.2, 18, 'crystal_5_p4_a');
    this.createCrystalMesh(20, 12.2, 16, 'crystal_5_p4_b');
  }

  spawnCrystalsLevel6() {
    this.createCrystalMesh(0, 4.2, 26, 'crystal_6_base_a');
    this.createCrystalMesh(-3, 4.2, 26, 'crystal_6_base_b');
    this.createCrystalMesh(3, 4.2, 26, 'crystal_6_base_c');

    this.createCrystalMesh(0, 12.2, -26, 'crystal_6_target_a');
    this.createCrystalMesh(-3, 12.2, -26, 'crystal_6_target_b');
    this.createCrystalMesh(3, 12.2, -26, 'crystal_6_target_c');

    this.createCrystalMesh(0, 5.0, 20, 'crystal_6_air_1');
    this.createCrystalMesh(-4, 7.2, 8, 'crystal_6_air_2');
    this.createCrystalMesh(4, 7.2, 8, 'crystal_6_air_3');
    this.createCrystalMesh(-4, 9.2, -3, 'crystal_6_air_4');
    this.createCrystalMesh(4, 9.2, -3, 'crystal_6_air_5');
    this.createCrystalMesh(0, 11.2, -18, 'crystal_6_air_6');

    this.createCrystalMesh(0, 1.2, 5, 'crystal_6_low_1');
    this.createCrystalMesh(0, 1.2, -5, 'crystal_6_low_2');
    this.createCrystalMesh(-5, 1.2, 0, 'crystal_6_low_3');
  }

  spawnCrystalsLevel7() {
    this.createCrystalMesh(0, 5.2, 26, 'crystal_7_spawn_a');
    this.createCrystalMesh(-3, 5.2, 26, 'crystal_7_spawn_b');
    this.createCrystalMesh(3, 5.2, 26, 'crystal_7_spawn_c');
    this.createCrystalMesh(-18, 7.2, 10, 'crystal_7_sw1_a');
    this.createCrystalMesh(-18, 7.2, 12, 'crystal_7_sw1_b');
    this.createCrystalMesh(18, 9.2, -10, 'crystal_7_sw2_a');
    this.createCrystalMesh(18, 9.2, -8, 'crystal_7_sw2_b');
    this.createCrystalMesh(0, 8.2, 0, 'crystal_7_ph1_a');
    this.createCrystalMesh(-2, 8.2, 0, 'crystal_7_ph1_b');
    this.createCrystalMesh(2, 8.2, 0, 'crystal_7_ph1_c');
    this.createCrystalMesh(0, 10.2, -20, 'crystal_7_ph2_a');
    this.createCrystalMesh(-2, 10.2, -20, 'crystal_7_ph2_b');
    this.createCrystalMesh(2, 10.2, -20, 'crystal_7_ph2_c');
    this.createCrystalMesh(0, 12.2, -32, 'crystal_7_target_a');
    this.createCrystalMesh(0, 12.2, -30, 'crystal_7_target_b');
  }

  spawnCrystalsLevel8() {
    this.createCrystalMesh(0, 4.2, 26, 'crystal_8_spawn_a');
    this.createCrystalMesh(-15, 5.2, 10, 'crystal_8_p1_a');
    this.createCrystalMesh(-15, 5.2, 12, 'crystal_8_p1_b');
    this.createCrystalMesh(-15, 5.2, 8, 'crystal_8_p1_c');
    this.createCrystalMesh(0, 23.2, 0, 'crystal_8_ceil_a');
    this.createCrystalMesh(-3, 23.2, 0, 'crystal_8_ceil_b');
    this.createCrystalMesh(3, 23.2, 0, 'crystal_8_ceil_c');
    this.createCrystalMesh(0, 23.2, -3, 'crystal_8_ceil_d');
    this.createCrystalMesh(0, 23.2, 3, 'crystal_8_ceil_e');
    this.createCrystalMesh(15, 13.2, -10, 'crystal_8_mid_a');
    this.createCrystalMesh(15, 13.2, -12, 'crystal_8_mid_b');
    this.createCrystalMesh(15, 13.2, -8, 'crystal_8_mid_c');
    this.createCrystalMesh(0, 15.2, -28, 'crystal_8_target_a');
    this.createCrystalMesh(-3, 15.2, -28, 'crystal_8_target_b');
    this.createCrystalMesh(3, 15.2, -28, 'crystal_8_target_c');
  }

  spawnCrystalsLevel9() {
    this.createCrystalMesh(0, 5.2, 30, 'crystal_9_spawn_a');
    this.createCrystalMesh(0, 5.2, 32, 'crystal_9_spawn_b');
    this.createCrystalMesh(0, 7.2, 18, 'crystal_9_ring_a');
    this.createCrystalMesh(0, 9.2, 6, 'crystal_9_ring_b');
    this.createCrystalMesh(0, 11.2, -6, 'crystal_9_ring_c');
    this.createCrystalMesh(0, 11.2, -30, 'crystal_9_boss_center');
    this.createCrystalMesh(-6, 11.2, -30, 'crystal_9_boss_l');
    this.createCrystalMesh(6, 11.2, -30, 'crystal_9_boss_r');
    this.createCrystalMesh(0, 11.2, -24, 'crystal_9_boss_f');
    this.createCrystalMesh(0, 11.2, -36, 'crystal_9_boss_b');
    this.createCrystalMesh(-6, 11.2, -36, 'crystal_9_boss_bl');
    this.createCrystalMesh(6, 11.2, -36, 'crystal_9_boss_br');
    this.createCrystalMesh(-6, 11.2, -24, 'crystal_9_boss_fl');
    this.createCrystalMesh(6, 11.2, -24, 'crystal_9_boss_fr');
    this.createCrystalMesh(0, 11.2, -39, 'crystal_9_boss_back');
  }

  // Collections accessors
  getColliders() {
    return this.colliders;
  }

  getCrystals() {
    return this.crystals;
  }

  getPlatforms() {
    return this.platforms;
  }

  getLasers() {
    return this.lasers;
  }

  getPortals() {
    return this.portals;
  }

  getGuards() {
    return this.guards;
  }

  getGravityLifts() {
    return this.gravityLifts;
  }

  getVelocityPads() {
    return this.velocityPads;
  }

  getSearchlights() {
    return this.searchlights;
  }

  getSweepers() {
    return this.sweepers;
  }

  getAmmoPacks() {
    return this.ammoPacks;
  }

  getSwitches() {
    return this.switches;
  }

  getPhasePlatforms() {
    return this.phasePlatforms;
  }

  getGravityFields() {
    return this.gravityFields;
  }

  getBarriers() {
    return this.barriers;
  }

  getBoostRings() {
    return this.boostRings;
  }

  getBossOverseer() {
    return this.bossOverseer;
  }
}
