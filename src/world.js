import * as THREE from 'three';

export class GameWorld {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // Store pillars: { position: Vector3, radius: number }
    this.crystals = [];   // Store crystal structures: { id, mesh, coreMesh, hullMesh, basePosition, bobOffset }
    
    this.platformSize = 80; // 80x80 square platform
  }

  build() {
    this.createSkybox();
    this.createFloorGrid();
    this.createMonoliths();
  }

  // 1. Create a deep space skybox using star particles and soft nebula clouds
  createSkybox() {
    // Starfield particle system
    const starCount = 1500;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      // Spawn stars on a spherical shell of radius 250 - 450
      const radius = 250 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      starPositions[i * 3] = x;
      starPositions[i * 3 + 1] = y;
      starPositions[i * 3 + 2] = z;

      // Varied colors (mostly white, blueish-white, warm orange)
      const colorType = Math.random();
      if (colorType < 0.7) {
        starColors[i * 3] = 1.0;     // White
        starColors[i * 3 + 1] = 1.0;
        starColors[i * 3 + 2] = 1.0;
      } else if (colorType < 0.9) {
        starColors[i * 3] = 0.7;     // Sci-fi Blue
        starColors[i * 3 + 1] = 0.85;
        starColors[i * 3 + 2] = 1.0;
      } else {
        starColors[i * 3] = 1.0;     // Soft Amber
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

    // Procedural Nebulae (Canvas texturing to avoid image dependencies)
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

    // Nebula 1: Magenta Cloud
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

    // Nebula 2: Cyan Cloud
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

  // 2. Create the neon grid floor platform
  createFloorGrid() {
    const halfSize = this.platformSize / 2;

    // Solid base dark floor mesh
    const floorGeo = new THREE.BoxGeometry(this.platformSize, 0.4, this.platformSize);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x05070a,
      roughness: 0.8,
      metalness: 0.9
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.2; // Top surface at y = 0
    this.scene.add(floor);

    // Neon-cyan Grid Helper Overlay
    const grid = new THREE.GridHelper(this.platformSize, 40, 0x00f0ff, 0x004455);
    grid.position.y = 0.01; // Slightly above floor to avoid z-fighting
    this.scene.add(grid);

    // Outer neon border lines
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

  // 3. Create monolithic futuristic towers (colliders)
  createMonoliths() {
    const monolithPositions = [
      { x: -18, z: -18, r: 2.2, h: 18 },
      { x: 18, z: -18, r: 2.2, h: 18 },
      { x: -18, z: 18, r: 2.2, h: 18 },
      { x: 18, z: 18, r: 2.2, h: 18 },
      { x: 0, z: -25, r: 3.5, h: 26 }, // Central back large tower
      { x: -28, z: 0, r: 2.8, h: 12 },  // Left side low tower
      { x: 28, z: 0, r: 2.8, h: 12 }   // Right side low tower
    ];

    monolithPositions.forEach((pos) => {
      // Cylinder base geometry (tall hexagons/cylinders)
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

      // Embedded neon glow rings on the towers
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
      }

      // Record for player-to-tower collision detection
      this.colliders.push({
        position: new THREE.Vector3(pos.x, 0, pos.z),
        radius: pos.r
      });
    });
  }

  // 4. Spawn crystals randomly around the map
  spawnCrystals(count = 15) {
    // Clear any existing crystals
    this.crystals.forEach((c) => this.scene.remove(c.mesh));
    this.crystals = [];

    const halfSize = this.platformSize / 2 - 4; // Buffer from edge

    for (let i = 0; i < count; i++) {
      let x, z, isValid = false;

      // Find a spawn position that isn't inside any monolith collider or the spawn point (0, 0)
      while (!isValid) {
        x = (Math.random() * 2 - 1) * halfSize;
        z = (Math.random() * 2 - 1) * halfSize;

        // Keep away from initial spawn point
        if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;

        isValid = true;
        
        // Ensure no collision with monolith towers
        for (const collider of this.colliders) {
          const dx = x - collider.position.x;
          const dz = z - collider.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < collider.radius + 3.0) {
            isValid = false;
            break;
          }
        }
      }

      const crystalGroup = new THREE.Group();
      crystalGroup.position.set(x, 1.2, z); // Floating height around chest level

      // Outer Layer: Rotating Holographic Wireframe Hull (Cyan)
      const hullGeo = new THREE.OctahedronGeometry(0.65, 0);
      const hullMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00f0ff,
        emissiveIntensity: 1.0,
        wireframe: true
      });
      const hullMesh = new THREE.Mesh(hullGeo, hullMat);
      crystalGroup.add(hullMesh);

      // Inner Layer: Glowing Solid Core (Pink/Magenta)
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
        id: `crystal_${i}`,
        mesh: crystalGroup,
        coreMesh: coreMesh,
        hullMesh: hullMesh,
        basePosition: new THREE.Vector3(x, 1.2, z),
        bobOffset: Math.random() * Math.PI * 2 // Randomized phase offset for bobbing animation
      });
    }

    return this.crystals;
  }

  // 5. Update crystal rotations and vertical floating bobbing animations
  update(time) {
    this.crystals.forEach((c) => {
      // Rotation
      c.coreMesh.rotation.y += 0.8 * 0.016;
      c.coreMesh.rotation.x += 0.4 * 0.016;

      c.hullMesh.rotation.y -= 0.5 * 0.016; // Opposite direction
      c.hullMesh.rotation.z += 0.3 * 0.016;

      // Bobbing floating animation
      const bobDistance = 0.18;
      const bobSpeed = 2.2;
      c.mesh.position.y = c.basePosition.y + Math.sin(time * bobSpeed + c.bobOffset) * bobDistance;
    });
  }

  // Remove a collected crystal from the scene and memory
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
}
