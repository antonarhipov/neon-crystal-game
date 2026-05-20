import * as THREE from 'three';

export class GameWorld {
  constructor(scene) {
    this.scene = scene;
    
    // Collections
    this.colliders = [];      // Tall monolith columns: { position: Vector3, radius: number }
    this.crystals = [];       // Collector targets: { id, mesh, coreMesh, hullMesh, basePosition, bobOffset, isAttachedPlatform }
    this.platforms = [];      // Floating boxes: { minX, maxX, minZ, maxZ, y, isMoving, mesh, startPos, endPos, speed, direction, t, displacement, previousPos, width, depth, height }
    this.lasers = [];         // Cyclic lasers: { mesh, posts[], isActive, timer, activeTime, inactiveTime, p1, p2, length, beamMat }
    this.portals = [];        // Portal pads: { id, mesh, position: Vector3, targetPortalId, color }
    this.guards = [];         // Enemy drones: { mesh, coreMesh, outerMesh, patrolNodes[], currentNodeIdx, isAlert, targetPlayer, speed, patrolSpeed, chaseSpeed }
    
    this.monolithMeshes = []; // Keep track of monolith meshes for cleanup
    this.platformSize = 80;   // Main bottom arena grid floor
    
    // Core structural assets (kept between level loads)
    this.skyboxBuilt = false;
    this.floorBuilt = false;
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
      // LEVEL 2: Adds vertical floating platforms, moving platforms, and cyclic lasers
      this.createMonoliths([
        { x: -22, z: -22, r: 2.0, h: 12 },
        { x: 22, z: -22, r: 2.0, h: 12 },
        { x: -22, z: 22, r: 2.0, h: 12 },
        { x: 22, z: 22, r: 2.0, h: 12 }
      ]);

      // Static Floating Platforms
      // format: createPlatform(x, y, z, w, h, d, borderNeonColor, movingParams)
      this.createPlatform(0, 4, 15, 14, 0.8, 14, 0x00f0ff);      // Platform A
      this.createPlatform(-18, 8, 0, 12, 0.8, 12, 0xff00b4);     // Platform B
      this.createPlatform(18, 8, 0, 12, 0.8, 12, 0xff00b4);      // Platform C
      this.createPlatform(0, 12, -15, 14, 0.8, 14, 0x00f0ff);    // Platform D (high)

      // Moving Platforms (vertical and horizontal transit nodes)
      // Moving Plat 1: Vertically between y=0 and y=4 at (x=-10, z=15)
      this.createPlatform(-10, 0, 15, 6, 0.4, 6, 0xffee00, {
        targetX: -10, targetY: 4, targetZ: 15, speed: 1.5
      });
      // Moving Plat 2: Horizontally at height y=8 between Platform B and Platform D
      this.createPlatform(-10, 8, -7.5, 6, 0.4, 6, 0xffee00, {
        targetX: -10, targetY: 8, targetZ: -15, speed: 1.2
      });
      // Moving Plat 3: Vertically between y=4 and y=12 at (x=10, z=-15)
      this.createPlatform(10, 4, -15, 6, 0.4, 6, 0xffee00, {
        targetX: 10, targetY: 12, targetZ: -15, speed: 1.6
      });

      // Cyclic lasers (crossing barriers on floor)
      // format: createLaser(x1, z1, x2, z2, groundY, activeT, inactiveT)
      this.createLaser(-25, 0, -5, 0, 0, 2.2, 1.8);
      this.createLaser(5, 0, 25, 0, 0, 2.2, 1.8);
      this.createLaser(0, -25, 0, -5, 0, 2.5, 1.5);
      this.createLaser(0, 5, 0, 25, 0, 2.5, 1.5);

      this.spawnCrystalsLevel2();

    } else if (levelNumber === 3) {
      // LEVEL 3: Guards, Portal Pads, Lasers, Moving Platforms
      this.createMonoliths([
        { x: -25, z: -25, r: 2.2, h: 10 },
        { x: 25, z: 25, r: 2.2, h: 10 }
      ]);

      // Static Platforms
      this.createPlatform(-20, 4, -20, 12, 0.8, 12, 0x00f0ff);   // Plat 1 (Low corner)
      this.createPlatform(20, 4, -20, 12, 0.8, 12, 0x00f0ff);    // Plat 2 (Low corner)
      this.createPlatform(-20, 8, 20, 12, 0.8, 12, 0xff00b4);    // Plat 3 (Mid corner)
      this.createPlatform(20, 8, 20, 12, 0.8, 12, 0xff00b4);     // Plat 4 (Mid corner)
      this.createPlatform(0, 12, 0, 15, 0.8, 15, 0xffee00);      // Plat 5 (Central High)

      // Moving Platforms
      // Vertical lifter for center Plat 5
      this.createPlatform(0, 0, -18, 6, 0.4, 6, 0xffee00, {
        targetX: 0, targetY: 12, targetZ: -18, speed: 1.5
      });
      // Horizontal connector at y=8
      this.createPlatform(0, 8, 20, 6, 0.4, 6, 0x00f0ff, {
        targetX: 0, targetY: 8, targetZ: 5, speed: 1.8
      });

      // Teleporters (Portal Pads pairs)
      // Portal Pair A (Magenta): Links Plat 1 (low) and Plat 4 (mid)
      const pa1 = this.createPortal(-20, 4.8, -20, 0xff00b4);
      const pa2 = this.createPortal(20, 8.8, 20, 0xff00b4);
      pa1.targetPortalId = pa2.id;
      pa2.targetPortalId = pa1.id;

      // Portal Pair B (Cyan): Links Plat 2 (low) and Plat 3 (mid)
      const pb1 = this.createPortal(20, 4.8, -20, 0x00f0ff);
      const pb2 = this.createPortal(-20, 8.8, 20, 0x00f0ff);
      pb1.targetPortalId = pb2.id;
      pb2.targetPortalId = pb1.id;

      // Portal Pair C (Yellow): Links Floor corner and Central high platform
      const pc1 = this.createPortal(0, 0.02, 28, 0xffee00);
      const pc2 = this.createPortal(0, 12.8, 0, 0xffee00);
      pc1.targetPortalId = pc2.id;
      pc2.targetPortalId = pc1.id;

      // Lasers (1 on central high platform, 2 on low platforms, 1 on floor)
      this.createLaser(-24, -20, -16, -20, 4.0, 2.0, 2.0); // Blocks Plat 1
      this.createLaser(16, -20, 24, -20, 4.0, 2.0, 2.0);  // Blocks Plat 2
      this.createLaser(-5, 0, 5, 0, 12.0, 1.8, 1.8);       // Sweeps across central Plat 5
      this.createLaser(-10, 0, 10, 0, 0, 2.2, 1.5);        // Floor lane obstacle

      // AI Patrol Guards
      // Guard 1: Floor rectangle patrol
      this.createGuard([
        { x: -16, y: 0, z: -16 },
        { x: -16, y: 0, z: 16 },
        { x: 16, y: 0, z: 16 },
        { x: 16, y: 0, z: -16 }
      ], 4.5);

      // Guard 2: High platform (Plat 5) perimeter patrol
      this.createGuard([
        { x: -5, y: 12, z: -5 },
        { x: 5, y: 12, z: -5 },
        { x: 5, y: 12, z: 5 },
        { x: -5, y: 12, z: 5 }
      ], 3.8);

      // Guard 3: Floor back row patrol
      this.createGuard([
        { x: -28, y: 0, z: -25 },
        { x: 28, y: 0, z: -25 }
      ], 5.5);

      this.spawnCrystalsLevel3();
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
  createPlatform(x, y, z, width, height, depth, color = 0x00f0ff, movingParams = null) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x090a10,
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
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - depth / 2,
      maxZ: z + depth / 2,
      y: y + height,
      isMoving: !!movingParams,
      color
    };

    if (movingParams) {
      platform.startPos = new THREE.Vector3(x, y + height / 2, z);
      platform.endPos = new THREE.Vector3(movingParams.targetX, movingParams.targetY + height / 2, movingParams.targetZ);
      platform.speed = movingParams.speed || 1.2;
      platform.direction = 1;
      platform.t = 0;
      platform.displacement = new THREE.Vector3();
      platform.previousPos = platform.startPos.clone();
      platform.width = width;
      platform.depth = depth;
      platform.height = height;
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

  // 7. Create AI Guard
  createGuard(patrolPoints, speed = 4.0) {
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
      chaseSpeed: speed * 1.85
    });
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
    this.createCrystalMesh(0, 5.2, 15, 'crystal_pA');      // Platform A
    this.createCrystalMesh(-18, 9.2, 0, 'crystal_pB1');    // Platform B
    this.createCrystalMesh(-18, 9.2, 3, 'crystal_pB2');
    this.createCrystalMesh(18, 9.2, 0, 'crystal_pC1');     // Platform C
    this.createCrystalMesh(18, 9.2, -3, 'crystal_pC2');
    this.createCrystalMesh(0, 13.2, -15, 'crystal_pD1');   // Platform D
    this.createCrystalMesh(3, 13.2, -15, 'crystal_pD2');

    // Crystal floating on Moving Platform 2
    // We attach it to the index of our moving platforms (1)
    this.createCrystalMesh(-10, 9.2, -7.5, 'crystal_moving_p2', 1);
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
    this.createCrystalMesh(-20, 5.2, -20, 'crystal_3_p1_a');
    this.createCrystalMesh(-18, 5.2, -22, 'crystal_3_p1_b');

    // Platform 2 (Low corner)
    this.createCrystalMesh(20, 5.2, -20, 'crystal_3_p2_a');
    this.createCrystalMesh(18, 5.2, -22, 'crystal_3_p2_b');

    // Platform 3 (Mid corner)
    this.createCrystalMesh(-20, 9.2, 20, 'crystal_3_p3_a');
    this.createCrystalMesh(-22, 9.2, 18, 'crystal_3_p3_b');

    // Platform 4 (Mid corner)
    this.createCrystalMesh(20, 9.2, 20, 'crystal_3_p4_a');
    this.createCrystalMesh(22, 9.2, 18, 'crystal_3_p4_b');

    // Platform 5 (Central High y=12)
    this.createCrystalMesh(0, 13.2, 0, 'crystal_3_p5_a');
    this.createCrystalMesh(3, 13.2, 3, 'crystal_3_p5_b');
    this.createCrystalMesh(-3, 13.2, -3, 'crystal_3_p5_c');
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
          // Slide base coordinate along with the moving platform mesh
          c.basePosition.copy(plat.mesh.position);
          c.basePosition.y += 1.2; // Offset height
        }
      }
      c.mesh.position.copy(c.basePosition);
      c.mesh.position.y += bobY;
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
          l.beamMat.opacity = 0.04; // Visual fade out
        }
      } else {
        if (l.timer >= l.inactiveTime) {
          l.isActive = true;
          l.timer = 0;
          l.beamMat.opacity = 0.85; // Visual fade in
        }
      }

      if (l.isActive) {
        // Visual pulsing spark fluctuation
        l.beamMat.opacity = 0.72 + Math.sin(time * 25.0) * 0.12;
      }
    });

    // 4. Update Portal beam rotations
    this.portals.forEach(port => {
      port.beamMesh.rotation.y += 0.8 * delta;
    });

    // 5. Update AI Guards patrol logic and chase actions
    this.guards.forEach(g => {
      // Rotation
      g.coreMesh.rotation.y += 1.4 * delta;
      g.coreMesh.rotation.x += 0.6 * delta;

      g.outerMesh.rotation.y -= (g.isAlert ? 4.8 : 0.8) * delta;
      g.outerMesh.rotation.z += (g.isAlert ? 2.8 : 0.4) * delta;

      let targetPos;
      if (g.isAlert && g.targetPlayer) {
        targetPos = new THREE.Vector3(g.targetPlayer.x, g.mesh.position.y, g.targetPlayer.z);
        g.speed = g.chaseSpeed;
        
        // Rapid alarm color pulsing (Red/Orange flashing)
        const flash = Math.sin(time * 18.0) > 0;
        g.coreMesh.material.color.setHex(flash ? 0xff0000 : 0xff7700);
        g.coreMesh.material.emissive.setHex(flash ? 0xff0000 : 0xff7700);
      } else {
        targetPos = g.patrolNodes[g.currentNodeIdx];
        g.speed = g.patrolSpeed;
        
        // Static alert red glow
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
    });
  }

  // Remove collected crystal from world scene
  removeCrystal(crystalId) {
    const index = this.crystals.findIndex((c) => c.id === crystalId);
    if (index !== -1) {
      const crystal = this.crystals[index];
      this.scene.remove(crystal.mesh);
      this.crystals.splice(index, 1);
    }
  }

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
}
