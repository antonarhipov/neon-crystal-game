import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.maxParticles = 500;

    // Allocate geometry buffers
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    // Particle material using Additive Blending for a neon glow appearance
    this.material = new THREE.PointsMaterial({
      size: 0.28,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);
  }

  // Spawn an explosion of sparks at the target position
  spawnExplosion(position, colorHex = 0xff00b4) {
    const pColor = new THREE.Color(colorHex);
    const count = 35; // Number of sparks per explosion

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift(); // Remove oldest active particle if buffer is full
      }

      // Random spherical velocity direction
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = 2.5 + Math.random() * 4.5;

      const vx = speed * Math.sin(phi) * Math.cos(theta);
      const vy = speed * Math.sin(phi) * Math.sin(theta) + 2.0; // Upward velocity bias
      const vz = speed * Math.cos(phi);

      this.particles.push({
        position: position.clone(),
        velocity: new THREE.Vector3(vx, vy, vz),
        color: pColor.clone(),
        age: 0,
        maxAge: 0.4 + Math.random() * 0.5 // Spark lifetime in seconds
      });
    }
  }

  update(delta) {
    // Process movement and filter out dead particles
    this.particles = this.particles.filter((p) => {
      p.position.addScaledVector(p.velocity, delta);

      // Apply downward gravity and drag/air friction
      p.velocity.y -= 4.5 * delta;
      p.velocity.x -= p.velocity.x * 2.0 * delta;
      p.velocity.z -= p.velocity.z * 2.0 * delta;

      p.age += delta;
      return p.age < p.maxAge;
    });

    // Populate buffers with current active particles
    const posAttr = this.geometry.getAttribute('position');
    const colAttr = this.geometry.getAttribute('color');

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (p) {
        posAttr.setXYZ(i, p.position.x, p.position.y, p.position.z);

        // Compute brightness fade based on particle age
        const lifeRatio = Math.max(0, 1.0 - p.age / p.maxAge);
        colAttr.setXYZ(
          i,
          p.color.r * lifeRatio,
          p.color.g * lifeRatio,
          p.color.b * lifeRatio
        );
      } else {
        // Move unused particle positions far away so they do not render
        posAttr.setXYZ(i, 99999, 99999, 99999);
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }
}
