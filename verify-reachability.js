import * as THREE from 'three';

// Mock DOM environment so Three.js and modules that use it don't throw ReferenceErrors in Node.js
globalThis.document = {
  createElement: () => ({
    getContext: () => ({
      createRadialGradient: () => ({ addColorStop: () => {} }),
      fillRect: () => {},
    }),
    width: 0,
    height: 0
  })
};

// Physics and jump limits
const PLAYER_HEIGHT = 1.8;
const MAX_JUMP_HEIGHT_SINGLE = 2.8;
const MAX_JUMP_HEIGHT_DOUBLE = 5.3;
const BASE_JUMP_DIST = 9.0;
const HORIZ_VELOCITY = 7.5;
const GRAVITY = 35.0;

// Helper to calculate time to fall dy height
function getFallTime(dy) {
  return Math.sqrt(2 * dy / GRAVITY);
}

// Calculate max horizontal distance of a jump/fall from yA to yB
function getMaxJumpDistance(yA, yB) {
  if (yB > yA) {
    const dy = yB - yA;
    if (dy > MAX_JUMP_HEIGHT_DOUBLE) return 0;
    return dy <= MAX_JUMP_HEIGHT_SINGLE ? BASE_JUMP_DIST : 6.5;
  } else {
    const dy = yA - yB;
    const fallTime = getFallTime(dy);
    return BASE_JUMP_DIST + HORIZ_VELOCITY * fallTime;
  }
}

// Distance between nearest points of two 1D intervals
function getIntervalDistance(minA, maxA, minB, maxB) {
  return Math.max(0, minB - maxA, minA - maxB);
}

// Get minimum horizontal distance between two platforms
function getPlatformHorizontalDistance(platA, platB) {
  const distX = getIntervalDistance(platA.minX, platA.maxX, platB.minX, platB.maxX);
  const distZ = getIntervalDistance(platA.minZ, platA.maxZ, platB.minZ, platB.maxZ);
  return Math.sqrt(distX * distX + distZ * distZ);
}

// Check if a point is within platform horizontal bounds (with padding)
function isPointOnPlatform(x, z, plat, padding = 0.5) {
  return x >= plat.minX - padding && x <= plat.maxX + padding &&
         z >= plat.minZ - padding && z <= plat.maxZ + padding;
}

// Define Level Data Structures
const LEVELS = {
  1: {
    spawn: { x: 0, y: 1.8, z: 0 },
    platforms: [
      { id: 'floor', minX: -40, maxX: 40, minY: 0, maxY: 0.1, minZ: -40, maxZ: 40, y: 0 }
    ],
    crystals: Array.from({ length: 15 }, (_, i) => ({ id: `crystal_1_${i}`, x: (i - 7) * 4, y: 1.2, z: (i - 7) * 3 })),
    portals: [],
    switches: [],
    gravityLifts: [],
    gravityFields: [],
    boostRings: [],
    target: { x: 0, y: 0, z: 0 }
  },
  2: {
    spawn: { x: 0, y: 1.8, z: 0 },
    platforms: [
      { id: 'floor', minX: -40, maxX: 40, minY: 0, maxY: 0.1, minZ: -40, maxZ: 40, y: 0 },
      { id: 'platA', minX: -7, maxX: 7, minY: 4, maxY: 4.8, minZ: 7, maxZ: 21, y: 4 },
      { id: 'platB', minX: -20.5, maxX: -9.5, minY: 8, maxY: 8.8, minZ: -5.5, maxZ: 5.5, y: 8 },
      { id: 'platC', minX: 9.5, maxX: 20.5, minY: 8, maxY: 8.8, minZ: -5.5, maxZ: 5.5, y: 8 },
      { id: 'platD', minX: -7, maxX: 7, minY: 11, maxY: 11.8, minZ: -21, maxZ: -7, y: 11 },
      // Stepping stones
      { id: 'stepB', minX: -9.5, maxX: -5.5, minY: 6, maxY: 6.4, minZ: 5, maxZ: 9, y: 6 },
      { id: 'stepC', minX: 5.5, maxX: 9.5, minY: 6, maxY: 6.4, minZ: 5, maxZ: 9, y: 6 },
      // Moving platforms (represented by their range of motion)
      { id: 'moving1', minX: -11, maxX: -5, minY: 0, maxY: 4.4, minZ: 11, maxZ: 17, y: 4 }, // floor to platA
      { id: 'moving2', minX: -15, maxX: -2, minY: 8, maxY: 9.9, minZ: -15, maxZ: -3, y: 9.5 }, // platB to platD
      { id: 'moving3', minX: 5, maxX: 11, minY: 4, maxY: 11.4, minZ: -17, maxZ: -11, y: 11 }, // floor to platD
      { id: 'moving4', minX: 2, maxX: 15, minY: 8, maxY: 9.9, minZ: -15, maxZ: -3, y: 9.5 } // platC to platD
    ],
    crystals: [
      { id: 'crystal_pA', x: 0, y: 5.2, z: 14 },
      { id: 'crystal_pB1', x: -15, y: 9.2, z: 0 },
      { id: 'crystal_pB2', x: -15, y: 9.2, z: 3 },
      { id: 'crystal_pC1', x: 15, y: 9.2, z: 0 },
      { id: 'crystal_pC2', x: 15, y: 9.2, z: -3 },
      { id: 'crystal_pD1', x: 0, y: 12.2, z: -14 },
      { id: 'crystal_pD2', x: 3, y: 12.2, z: -14 },
      { id: 'crystal_moving_p2', x: -12, y: 9.2, z: -6 },
      // Floor crystals
      { id: 'crystal_f_0', x: -10, y: 1.2, z: -10 },
      { id: 'crystal_f_1', x: 10, y: 1.2, z: 10 },
      { id: 'crystal_f_2', x: -25, y: 1.2, z: 25 },
      { id: 'crystal_f_3', x: 25, y: 1.2, z: -25 },
      { id: 'crystal_f_4', x: 0, y: 1.2, z: 0 },
      { id: 'crystal_f_5', x: 5, y: 1.2, z: -5 }
    ],
    portals: [],
    switches: [],
    gravityLifts: [],
    gravityFields: [],
    boostRings: [],
    target: { x: 0, y: 11, z: -14 }
  },
  3: {
    spawn: { x: 0, y: 1.8, z: 0 },
    platforms: [
      { id: 'floor', minX: -40, maxX: 40, minY: 0, maxY: 0.1, minZ: -40, maxZ: 40, y: 0 },
      { id: 'plat1', minX: -21.5, maxX: -10.5, minY: 4, maxY: 4.8, minZ: -21.5, maxZ: -10.5, y: 4 },
      { id: 'plat2', minX: 10.5, maxX: 21.5, minY: 4, maxY: 4.8, minZ: -21.5, maxZ: -10.5, y: 4 },
      { id: 'plat3', minX: -21.5, maxX: -10.5, minY: 8, maxY: 8.8, minZ: 10.5, maxZ: 21.5, y: 8 },
      { id: 'plat4', minX: 10.5, maxX: 21.5, minY: 8, maxY: 8.8, minZ: 10.5, maxZ: 21.5, y: 8 },
      { id: 'plat5', minX: -7.5, maxX: 7.5, minY: 11, maxY: 11.8, minZ: -7.5, maxZ: 7.5, y: 11 },
      { id: 'elevator', minX: -3, maxX: 3, minY: 0, maxY: 11.4, minZ: -21, maxZ: -15, y: 11 }
    ],
    portals: [
      { id: 'portal1', targetPortalId: 'portal2', x: -16, y: 4.8, z: -16 },
      { id: 'portal2', targetPortalId: 'portal1', x: 16, y: 8.8, z: 16 },
      { id: 'portal3', targetPortalId: 'portal4', x: 16, y: 4.8, z: -16 },
      { id: 'portal4', targetPortalId: 'portal3', x: -16, y: 8.8, z: 16 },
      { id: 'portal5', targetPortalId: 'portal6', x: 0, y: 0.02, z: 24 },
      { id: 'portal6', targetPortalId: 'portal5', x: 0, y: 11.8, z: 0 }
    ],
    crystals: [
      { id: 'crystal_3_p1_a', x: -16, y: 5.2, z: -16 },
      { id: 'crystal_3_p1_b', x: -14, y: 5.2, z: -18 },
      { id: 'crystal_3_p2_a', x: 16, y: 5.2, z: -16 },
      { id: 'crystal_3_p2_b', x: 14, y: 5.2, z: -18 },
      { id: 'crystal_3_p3_a', x: -16, y: 9.2, z: 16 },
      { id: 'crystal_3_p3_b', x: -18, y: 9.2, z: 14 },
      { id: 'crystal_3_p4_a', x: 16, y: 9.2, z: 16 },
      { id: 'crystal_3_p4_b', x: 18, y: 9.2, z: 14 },
      { id: 'crystal_3_p5_a', x: 0, y: 12.2, z: 0 },
      { id: 'crystal_3_p5_b', x: 3, y: 12.2, z: 3 },
      { id: 'crystal_3_p5_c', x: -3, y: 12.2, z: -3 },
      // Floor crystals
      { id: 'crystal_3_f_0', x: -10, y: 1.2, z: -10 },
      { id: 'crystal_3_f_1', x: 10, y: 1.2, z: 10 },
      { id: 'crystal_3_f_2', x: -20, y: 1.2, z: 20 },
      { id: 'crystal_3_f_3', x: 20, y: 1.2, z: -20 }
    ],
    switches: [],
    gravityLifts: [],
    gravityFields: [],
    boostRings: [],
    target: { x: 0, y: 11, z: 0 }
  },
  4: {
    spawn: { x: 0, y: 5.8, z: 26 },
    platforms: [
      { id: 'floor', minX: -40, maxX: 40, minY: 0, maxY: 0.1, minZ: -40, maxZ: 40, y: 0 },
      { id: 'spawn', minX: -5, maxX: 5, minY: 4, maxY: 4.8, minZ: 21, maxZ: 31, y: 4 },
      { id: 'platLeft', minX: -22, maxX: -14, minY: 6, maxY: 6.8, minZ: 4, maxZ: 12, y: 6 },
      { id: 'platRight', minX: 14, maxX: 22, minY: 6, maxY: 6.8, minZ: 4, maxZ: 12, y: 6 },
      { id: 'platBack', minX: -4, maxX: 4, minY: 5, maxY: 5.8, minZ: -20, maxZ: -12, y: 5 },
      { id: 'platCenter', minX: -6, maxX: 6, minY: 10, maxY: 10.8, minZ: -6, maxZ: 6, y: 10 }
    ],
    gravityLifts: [
      { x: -18, z: 8, height: 6, radius: 2.0 },
      { x: 18, z: 8, height: 6, radius: 2.0 }
    ],
    crystals: [
      { id: 'crystal_4_pLeft_a', x: -18, y: 7.2, z: 8 },
      { id: 'crystal_4_pLeft_b', x: -16, y: 7.2, z: 10 },
      { id: 'crystal_4_pLeft_c', x: -20, y: 7.2, z: 6 },
      { id: 'crystal_4_pRight_a', x: 18, y: 7.2, z: 8 },
      { id: 'crystal_4_pRight_b', x: 16, y: 7.2, z: 10 },
      { id: 'crystal_4_pRight_c', x: 20, y: 7.2, z: 6 },
      { id: 'crystal_4_pBack', x: 0, y: 6.2, z: -16 },
      { id: 'crystal_4_pCenter_a', x: 0, y: 11.2, z: 0 },
      { id: 'crystal_4_pCenter_b', x: 2, y: 11.2, z: 2 },
      { id: 'crystal_4_pCenter_c', x: -2, y: 11.2, z: -2 },
      { id: 'crystal_4_pCenter_d', x: -2, y: 11.2, z: 2 },
      { id: 'crystal_4_pCenter_e', x: 2, y: 11.2, z: -2 },
      // Floor crystals
      { id: 'crystal_4_f_0', x: -15, y: 1.2, z: -15 },
      { id: 'crystal_4_f_1', x: 15, y: 1.2, z: 15 },
      { id: 'crystal_4_f_2', x: -25, y: 1.2, z: 25 }
    ],
    portals: [],
    switches: [],
    gravityFields: [],
    boostRings: [],
    target: { x: 0, y: 10, z: 0 }
  },
  5: {
    spawn: { x: 0, y: 1.8, z: 0 },
    platforms: [
      { id: 'floor', minX: -40, maxX: 40, minY: 0, maxY: 0.1, minZ: -40, maxZ: 40, y: 0 },
      // Updated Level 5 platforms to X/Z = 18 coordinates
      { id: 'plat1', minX: -24, maxX: -12, minY: 6, maxY: 6.8, minZ: -24, maxZ: -12, y: 6 },
      { id: 'plat2', minX: 12, maxX: 24, minY: 6, maxY: 6.8, minZ: -24, maxZ: -12, y: 6 },
      { id: 'plat3', minX: -24, maxX: -12, minY: 11, maxY: 11.8, minZ: 12, maxZ: 24, y: 11 },
      { id: 'plat4', minX: 12, maxX: 24, minY: 11, maxY: 11.8, minZ: 12, maxZ: 24, y: 11 },
      { id: 'platCenter', minX: -6, maxX: 6, minY: 14, maxY: 14.8, minZ: -6, maxZ: 6, y: 14 },
      // Stepping stones
      { id: 'stepLeft', minX: -14, maxX: -10, minY: 2.5, maxY: 2.9, minZ: 4, maxZ: 8, y: 2.5 },
      { id: 'stepRight', minX: 10, maxX: 14, minY: 2.5, maxY: 2.9, minZ: 4, maxZ: 8, y: 2.5 },
      // Timed rising gates (can stand on them from Y=6.0 to Y=12.0)
      { id: 'gate1', minX: -12.5, maxX: -11.5, minY: 6.0, maxY: 12.0, minZ: -4, maxZ: 4, y: 12 },
      { id: 'gate2', minX: 11.5, maxX: 12.5, minY: 6.0, maxY: 12.0, minZ: -4, maxZ: 4, y: 12 }
    ],
    portals: [
      { id: 'portal1', targetPortalId: 'portal2', x: -18, y: 6.8, z: -18 },
      { id: 'portal2', targetPortalId: 'portal1', x: 18, y: 11.8, z: 18 },
      { id: 'portal3', targetPortalId: 'portal4', x: 18, y: 6.8, z: -18 },
      { id: 'portal4', targetPortalId: 'portal3', x: -18, y: 11.8, z: 18 }
    ],
    crystals: [
      // Updated crystal positions to align with new Platform 1, 2, 3, 4 positions
      { id: 'crystal_5_p1_a', x: -18, y: 7.2, z: -18 },
      { id: 'crystal_5_p1_b', x: -16, y: 7.2, z: -20 },
      { id: 'crystal_5_p2_a', x: 18, y: 7.2, z: -18 },
      { id: 'crystal_5_p2_b', x: 16, y: 7.2, z: -20 },
      { id: 'crystal_5_p3_a', x: -18, y: 12.2, z: 18 },
      { id: 'crystal_5_p3_b', x: -20, y: 12.2, z: 16 },
      { id: 'crystal_5_p4_a', x: 18, y: 12.2, z: 18 },
      { id: 'crystal_5_p4_b', x: 20, y: 12.2, z: 16 },
      // Floor crystals
      { id: 'crystal_5_f_0', x: -30, y: 1.2, z: -28 },
      { id: 'crystal_5_f_1', x: 30, y: 1.2, z: -28 },
      { id: 'crystal_5_f_2', x: -30, y: 1.2, z: 28 },
      { id: 'crystal_5_f_3', x: 30, y: 1.2, z: 28 },
      { id: 'crystal_5_f_4', x: 0, y: 1.2, z: -18 },
      { id: 'crystal_5_f_5', x: 0, y: 1.2, z: 18 }
    ],
    switches: [],
    gravityLifts: [],
    gravityFields: [],
    boostRings: [],
    target: { x: 0, y: 14, z: 0 }
  },
  6: {
    spawn: { x: 0, y: 4.8, z: 26 },
    platforms: [
      { id: 'spawn', minX: -6, maxX: 6, minY: 3, maxY: 3.8, minZ: 20, maxZ: 32, y: 3 },
      { id: 'target', minX: -6, maxX: 6, minY: 11, maxY: 11.8, minZ: -32, maxZ: -20, y: 11 },
      // Fading platforms
      { id: 'fade1', minX: -3, maxX: 3, minY: 5, maxY: 5.6, minZ: 11, maxZ: 17, y: 5 },
      { id: 'fade2', minX: -11, maxX: -5, minY: 7, maxY: 7.6, minZ: 0, maxZ: 6, y: 7 },
      { id: 'fade3', minX: 5, maxX: 11, minY: 7, maxY: 7.6, minZ: 0, maxZ: 6, y: 7 },
      { id: 'fade4', minX: -3, maxX: 3, minY: 9, maxY: 9.6, minZ: -13, maxZ: -7, y: 9 }
    ],
    gravityLifts: [
      { x: 0, z: 0, height: 7, radius: 1.5 } // Recovery lift
    ],
    crystals: [
      { id: 'crystal_6_base_a', x: 0, y: 4.2, z: 26 },
      { id: 'crystal_6_base_b', x: -3, y: 4.2, z: 26 },
      { id: 'crystal_6_base_c', x: 3, y: 4.2, z: 26 },
      { id: 'crystal_6_target_a', x: 0, y: 12.2, z: -26 },
      { id: 'crystal_6_target_b', x: -3, y: 12.2, z: -26 },
      { id: 'crystal_6_target_c', x: 3, y: 12.2, z: -26 },
      { id: 'crystal_6_fade_1', x: 0, y: 6.2, z: 14 },
      { id: 'crystal_6_fade_2', x: -8, y: 8.2, z: 3 },
      { id: 'crystal_6_fade_3', x: 8, y: 8.2, z: 3 },
      { id: 'crystal_6_fade_4', x: 0, y: 10.2, z: -10 },
      // Floor crystals
      { id: 'crystal_6_low_1', x: 0, y: 1.2, z: 5 },
      { id: 'crystal_6_low_2', x: 0, y: 1.2, z: -5 },
      { id: 'crystal_6_low_3', x: -5, y: 1.2, z: 0 }
    ],
    portals: [],
    switches: [],
    gravityFields: [],
    boostRings: [],
    target: { x: 0, y: 11, z: -26 }
  },
  7: {
    spawn: { x: 0, y: 5.8, z: 26 },
    platforms: [
      { id: 'spawn', minX: -5, maxX: 5, minY: 4, maxY: 4.8, minZ: 21, maxZ: 31, y: 4 },
      { id: 'switch1Plat', minX: -21, maxX: -15, minY: 6, maxY: 6.8, minZ: 7, maxZ: 13, y: 6 },
      { id: 'switch2Plat', minX: 15, maxX: 21, minY: 8, maxY: 8.8, minZ: -13, maxZ: -7, y: 8 },
      { id: 'target', minX: -5, maxX: 5, minY: 11, maxY: 11.8, minZ: -37, maxZ: -27, y: 11 },
      
      // Stepping stones
      { id: 'step1', minX: -2, maxX: 2, minY: 5, maxY: 5.6, minZ: 15, maxZ: 19, y: 5 },
      { id: 'step2', minX: -2, maxX: 2, minY: 6, maxY: 6.6, minZ: 6.5, maxZ: 10.5, y: 6, phaseId: 'phase1', isActive: false },
      { id: 'step3', minX: -2, maxX: 2, minY: 8, maxY: 8.6, minZ: -10, maxZ: -6, y: 8 },
      { id: 'step4', minX: -2, maxX: 2, minY: 10, maxY: 10.6, minZ: -26, maxZ: -22, y: 10, phaseId: 'phase2', isActive: false },

      // Phase platforms
      { id: 'phasePlat1', minX: -4, maxX: 4, minY: 7, maxY: 7.8, minZ: -4, maxZ: 4, y: 7, phaseId: 'phase1', isActive: false },
      { id: 'phasePlat2', minX: -4, maxX: 4, minY: 9, maxY: 9.8, minZ: -20, maxZ: -12, y: 9, phaseId: 'phase2', isActive: false }
    ],
    portals: [
      { id: 'portal1', targetPortalId: 'portal2', x: -3, y: 4.8, z: 26 },
      { id: 'portal2', targetPortalId: 'portal1', x: -18, y: 6.8, z: 10 },
      { id: 'portal3', targetPortalId: 'portal4', x: 3, y: 7.8, z: 0 },
      { id: 'portal4', targetPortalId: 'portal3', x: 18, y: 8.8, z: -10 }
    ],
    switches: [
      { id: 'switch1', targetId: 'phase1', x: -18, y: 6.8, z: 10 },
      { id: 'switch2', targetId: 'phase2', x: 18, y: 8.8, z: -10 }
    ],
    crystals: [
      { id: 'crystal_7_spawn_a', x: 0, y: 5.2, z: 26 },
      { id: 'crystal_7_spawn_b', x: -3, y: 5.2, z: 26 },
      { id: 'crystal_7_spawn_c', x: 3, y: 5.2, z: 26 },
      { id: 'crystal_7_sw1_a', x: -18, y: 7.2, z: 10 },
      { id: 'crystal_7_sw1_b', x: -18, y: 7.2, z: 12 },
      { id: 'crystal_7_sw2_a', x: 18, y: 9.2, z: -10 },
      { id: 'crystal_7_sw2_b', x: 18, y: 9.2, z: -8 },
      { id: 'crystal_7_ph1_a', x: 0, y: 8.2, z: 0 },
      { id: 'crystal_7_ph1_b', x: -2, y: 8.2, z: 0 },
      { id: 'crystal_7_ph1_c', x: 2, y: 8.2, z: 0 },
      { id: 'crystal_7_ph2_a', x: 0, y: 10.2, z: -20 },
      { id: 'crystal_7_ph2_b', x: -2, y: 10.2, z: -20 },
      { id: 'crystal_7_ph2_c', x: 2, y: 10.2, z: -20 },
      { id: 'crystal_7_target_a', x: 0, y: 12.2, z: -32 },
      { id: 'crystal_7_target_b', x: 0, y: 12.2, z: -30 }
    ],
    gravityLifts: [],
    gravityFields: [],
    boostRings: [],
    target: { x: 0, y: 11, z: -32 }
  },
  8: {
    spawn: { x: 0, y: 4.8, z: 26 },
    platforms: [
      { id: 'spawn', minX: -5, maxX: 5, minY: 3, maxY: 3.8, minZ: 21, maxZ: 31, y: 3 },
      { id: 'platA', minX: -19, maxX: -11, minY: 4, maxY: 4.8, minZ: 6, maxZ: 14, y: 4 },
      { id: 'platB', minX: -7, maxX: 7, minY: 22, maxY: 22.8, minZ: -7, maxZ: 7, y: 22 },
      { id: 'platC', minX: 11, maxX: 19, minY: 12, maxY: 12.8, minZ: -14, maxZ: -6, y: 12 },
      { id: 'target', minX: -5, maxX: 5, minY: 14, maxY: 14.8, minZ: -33, maxZ: -23, y: 14 }
    ],
    gravityFields: [
      // Spans Y[3, 22], Z[6, 14], X[-4, 4]
      { id: 'field1', minX: -4, maxX: 4, minY: 3, maxY: 22, minZ: 6, maxZ: 14 },
      // Spans Y[0, 14], Z[-19, -11], X[-4, 4]
      { id: 'field2', minX: -4, maxX: 4, minY: 0, maxY: 14, minZ: -19, maxZ: -11 }
    ],
    crystals: [
      { id: 'crystal_8_spawn_a', x: 0, y: 4.2, z: 26 },
      { id: 'crystal_8_p1_a', x: -15, y: 5.2, z: 10 },
      { id: 'crystal_8_p1_b', x: -15, y: 5.2, z: 12 },
      { id: 'crystal_8_p1_c', x: -15, y: 5.2, z: 8 },
      { id: 'crystal_8_ceil_a', x: 0, y: 23.2, z: 0 },
      { id: 'crystal_8_ceil_b', x: -3, y: 23.2, z: 0 },
      { id: 'crystal_8_ceil_c', x: 3, y: 23.2, z: 0 },
      { id: 'crystal_8_ceil_d', x: 0, y: 23.2, z: -3 },
      { id: 'crystal_8_ceil_e', x: 0, y: 23.2, z: 3 },
      { id: 'crystal_8_mid_a', x: 15, y: 13.2, z: -10 },
      { id: 'crystal_8_mid_b', x: 15, y: 13.2, z: -12 },
      { id: 'crystal_8_mid_c', x: 15, y: 13.2, z: -8 },
      { id: 'crystal_8_target_a', x: 0, y: 15.2, z: -28 },
      { id: 'crystal_8_target_b', x: -3, y: 15.2, z: -28 },
      { id: 'crystal_8_target_c', x: 3, y: 15.2, z: -28 }
    ],
    portals: [],
    switches: [],
    gravityLifts: [],
    boostRings: [],
    target: { x: 0, y: 14, z: -28 }
  },
  9: {
    spawn: { x: 0, y: 5.8, z: 30 },
    platforms: [
      { id: 'spawn', minX: -6, maxX: 6, minY: 4, maxY: 4.8, minZ: 24, maxZ: 36, y: 4 },
      { id: 'bossArena', minX: -12, maxX: 12, minY: 10, maxY: 10.8, minZ: -42, maxZ: -18, y: 10 },
      // Left Wing
      { id: 'platLeft', minX: -19, maxX: -11, minY: 6, maxY: 6.8, minZ: 16, maxZ: 24, y: 6 },
      { id: 'platLeftMid', minX: -22, maxX: -14, minY: 8.8, maxY: 9.6, minZ: 1, maxZ: 9, y: 8.8 },
      { id: 'platLeftHigh', minX: -18, maxX: -10, minY: 11, maxY: 11.8, minZ: -18, maxZ: -10, y: 11 },
      // Right Wing
      { id: 'platRight', minX: 11, maxX: 19, minY: 6, maxY: 6.8, minZ: 16, maxZ: 24, y: 6 },
      { id: 'platRightMid', minX: 11, maxX: 19, minY: 8, maxY: 8.8, minZ: 8, maxZ: 16, y: 8 },
      { id: 'platRightHigh', minX: 10, maxX: 18, minY: 11, maxY: 11.8, minZ: -18, maxZ: -10, y: 11 },
      // Moving Platforms
      { id: 'movingLeft', minX: -16, maxX: -12, minY: 8.8, maxY: 12.2, minZ: -6, maxZ: -2, y: 11 },
      { id: 'movingRight', minX: 12, maxX: 16, minY: 11, maxY: 11.8, minZ: -10, maxZ: 12, y: 11 }
    ],
    portals: [
      { id: 'portal1', targetPortalId: 'portal2', x: -15, y: 6.8, z: 20 },
      { id: 'portal2', targetPortalId: 'portal1', x: -18, y: 9.6, z: 5 }
    ],
    switches: [],
    gravityLifts: [
      { x: 15, z: 12, height: 8.0, radius: 2.2 }
    ],
    gravityFields: [],
    boostRings: [],
    crystals: [
      { id: 'crystal_9_spawn_a', x: 0, y: 5.2, z: 30 },
      { id: 'crystal_9_spawn_b', x: 0, y: 5.2, z: 32 },
      { id: 'crystal_9_ring_a', x: -15, y: 7.2, z: 20 },
      { id: 'crystal_9_ring_b', x: 15, y: 7.2, z: 20 },
      { id: 'crystal_9_ring_c', x: -14, y: 12.2, z: -14 },
      { id: 'crystal_9_boss_center', x: 0, y: 11.2, z: -30 },
      { id: 'crystal_9_boss_l', x: -6, y: 11.2, z: -30 },
      { id: 'crystal_9_boss_r', x: 6, y: 11.2, z: -30 },
      { id: 'crystal_9_boss_f', x: 0, y: 11.2, z: -24 },
      { id: 'crystal_9_boss_b', x: 0, y: 11.2, z: -36 },
      { id: 'crystal_9_boss_bl', x: -6, y: 11.2, z: -36 },
      { id: 'crystal_9_boss_br', x: 6, y: 11.2, z: -36 },
      { id: 'crystal_9_boss_fl', x: -6, y: 11.2, z: -24 },
      { id: 'crystal_9_boss_fr', x: 6, y: 11.2, z: -24 },
      { id: 'crystal_9_boss_back', x: 0, y: 11.2, z: -39 }
    ],
    target: { x: 0, y: 10, z: -30 }
  }
};

// BFS Reachability Checker
function runReachabilityCheck(levelNum) {
  const level = LEVELS[levelNum];
  if (!level) {
    console.error(`Level ${levelNum} not defined.`);
    return false;
  }

  console.log(`\n==================================================`);
  console.log(`RUNNING REACHABILITY ANALYSIS FOR SECTOR ${levelNum}`);
  console.log(`==================================================`);

  // Active state tracks which platforms/items are reachable
  // A state key is "platformId | activeSwitchesSorted"
  const visitedStates = new Set();
  const reachablePlatforms = new Set();
  const reachableCrystals = new Set();
  const reachableSwitches = new Set();
  
  // Find initial platform of player spawn
  let spawnPlat = null;
  for (const plat of level.platforms) {
    if (plat.phaseId) continue; // Skip phase platforms initially
    if (isPointOnPlatform(level.spawn.x, level.spawn.z, plat)) {
      spawnPlat = plat;
      break;
    }
  }
  
  if (!spawnPlat) {
    // If no platform, player falls, look for any floor or platform directly under spawn
    for (const plat of level.platforms) {
      if (plat.phaseId) continue;
      if (isPointOnPlatform(level.spawn.x, level.spawn.z, plat) && plat.y < level.spawn.y) {
        spawnPlat = plat;
        break;
      }
    }
  }

  if (!spawnPlat) {
    console.error(`[ERROR] Player spawn point (${level.spawn.x}, ${level.spawn.y}, ${level.spawn.z}) has no platform underneath!`);
    return false;
  }

  const queue = [];
  
  // State: { platId, activatedSwitches: Array }
  const initialState = { platId: spawnPlat.id, activatedSwitches: [] };
  queue.push(initialState);
  
  const stateKey = (platId, sws) => `${platId}|${sws.slice().sort().join(',')}`;
  visitedStates.add(stateKey(spawnPlat.id, []));
  reachablePlatforms.add(spawnPlat.id);

  while (queue.length > 0) {
    const { platId, activatedSwitches } = queue.shift();
    const currentPlat = level.platforms.find(p => p.id === platId);

    // Helper to check if a phase platform is active under current switches
    const isPlatformActive = (plat) => {
      if (!plat.phaseId) return true;
      return activatedSwitches.includes(plat.phaseId);
    };

    // 1. Collect crystals that are reachable from the current platform
    for (const crystal of level.crystals) {
      if (reachableCrystals.has(crystal.id)) continue;
      
      // A crystal is reachable if it is on an active platform we can stand on, or if we can jump/fall to its location.
      // First, find the platform underneath or containing the crystal
      let crystalPlat = null;
      for (const plat of level.platforms) {
        if (!isPlatformActive(plat)) continue;
        if (isPointOnPlatform(crystal.x, crystal.z, plat, 1.0) && Math.abs(crystal.y - (plat.y + PLAYER_HEIGHT - 0.6)) < 2.0) {
          crystalPlat = plat;
          break;
        }
      }

      // If the crystal is on a platform we already know is reachable, we can collect it!
      if (crystalPlat && reachablePlatforms.has(crystalPlat.id)) {
        reachableCrystals.add(crystal.id);
        continue;
      }

      // If the crystal is in a gravity field, can we reach it?
      let inField = false;
      for (const field of level.gravityFields) {
        if (crystal.x >= field.minX && crystal.x <= field.maxX &&
            crystal.z >= field.minZ && crystal.z <= field.maxZ &&
            crystal.y >= field.minY && crystal.y <= field.maxY) {
          inField = true;
          break;
        }
      }

      if (inField) {
        // Can we enter the field? Yes, if we can reach any platform near the field, we can enter.
        let canEnterField = false;
        for (const field of level.gravityFields) {
          const distX = getIntervalDistance(currentPlat.minX, currentPlat.maxX, field.minX, field.maxX);
          const distZ = getIntervalDistance(currentPlat.minZ, currentPlat.maxZ, field.minZ, field.maxZ);
          const distH = Math.sqrt(distX * distX + distZ * distZ);
          if (distH <= BASE_JUMP_DIST && currentPlat.y >= field.minY && currentPlat.y <= field.maxY) {
            canEnterField = true;
            break;
          }
        }
        if (canEnterField) {
          reachableCrystals.add(crystal.id);
          continue;
        }
      }

      // Check if we can jump directly to the crystal from current platform
      const mockPlat = {
        minX: crystal.x - 0.5, maxX: crystal.x + 0.5,
        minZ: crystal.z - 0.5, maxZ: crystal.z + 0.5,
        y: crystal.y - PLAYER_HEIGHT
      };
      const distH = getPlatformHorizontalDistance(currentPlat, mockPlat);
      const maxJumpDist = getMaxJumpDistance(currentPlat.y, mockPlat.y);
      if (maxJumpDist > 0 && distH <= maxJumpDist) {
        reachableCrystals.add(crystal.id);
      }
    }

    // 2. Shoot switches within range from the current platform
    for (const sw of level.switches) {
      if (activatedSwitches.includes(sw.targetId)) continue;
      
      const platCenterX = (currentPlat.minX + currentPlat.maxX) / 2;
      const platCenterZ = (currentPlat.minZ + currentPlat.maxZ) / 2;
      const dist = Math.sqrt((sw.x - platCenterX) ** 2 + (sw.z - platCenterZ) ** 2 + (sw.y - currentPlat.y) ** 2);
      
      if (dist <= 40.0) { // Shoot range
        reachableSwitches.add(sw.id);
        const nextSws = [...activatedSwitches, sw.targetId];
        const nextKey = stateKey(currentPlat.id, nextSws);
        if (!visitedStates.has(nextKey)) {
          visitedStates.add(nextKey);
          queue.push({ platId: currentPlat.id, activatedSwitches: nextSws });
        }
      }
    }

    // 3. Teleport via portals on current platform
    for (const port of level.portals) {
      const isPortOnCurrPlat = isPointOnPlatform(port.x, port.z, currentPlat) && 
        (Math.abs(port.y - (currentPlat.y + 0.8)) < 1.0 || (currentPlat.id === 'floor' && port.y < 0.5));
      
      if (isPortOnCurrPlat) {
        const targetPort = level.portals.find(p => p.id === port.targetPortalId);
        if (targetPort) {
          const targetPlat = level.platforms.find(plat => {
            if (!isPlatformActive(plat)) return false;
            if (!isPointOnPlatform(targetPort.x, targetPort.z, plat)) return false;
            const yDiff = Math.abs(targetPort.y - (plat.y + 0.8));
            return yDiff < 1.0 || (plat.id === 'floor' && targetPort.y < 0.5);
          });
          if (targetPlat) {
            const nextKey = stateKey(targetPlat.id, activatedSwitches);
            if (!visitedStates.has(nextKey)) {
              visitedStates.add(nextKey);
              reachablePlatforms.add(targetPlat.id);
              queue.push({ platId: targetPlat.id, activatedSwitches });
            }
          }
        }
      }
    }

    // 4. Move through Boost Rings
    for (const ring of level.boostRings) {
      const ringPlat = { minX: ring.x - 1, maxX: ring.x + 1, minZ: ring.z - 1, maxZ: ring.z + 1, y: ring.y - PLAYER_HEIGHT };
      const distH = getPlatformHorizontalDistance(currentPlat, ringPlat);
      if (distH <= BASE_JUMP_DIST && Math.abs(currentPlat.y - ringPlat.y) <= MAX_JUMP_HEIGHT_DOUBLE) {
        // Boost ring launch calculations
        const launchX = ring.x + ring.direction.x * 40;
        const launchZ = ring.z + ring.direction.z * 40;
        const launchY = ring.y + ring.direction.y * 40;
        
        // Flight Trajectory Crystal Collection: check if player passes near crystals in the air
        for (const crystal of level.crystals) {
          if (reachableCrystals.has(crystal.id)) continue;
          
          const minLz = Math.min(ring.z, launchZ);
          const maxLz = Math.max(ring.z, launchZ);
          const minLx = Math.min(ring.x, launchX);
          const maxLx = Math.max(ring.x, launchX);
          
          const inX = crystal.x >= minLx - 2.0 && crystal.x <= maxLx + 2.0;
          const inZ = crystal.z >= minLz && crystal.z <= maxLz;
          
          if (inX && inZ) {
            const denom = launchZ - ring.z;
            const t = denom !== 0 ? (crystal.z - ring.z) / denom : 0.5;
            const trajectoryY = ring.y + t * (launchY - ring.y);
            const distY = Math.abs(crystal.y - trajectoryY);
            if (distY <= 3.0) { // within flight range
              reachableCrystals.add(crystal.id);
            }
          }
        }
        
        for (const plat of level.platforms) {
          if (!isPlatformActive(plat)) continue;
          
          const minLz = Math.min(ring.z, launchZ);
          const maxLz = Math.max(ring.z, launchZ);
          const minLx = Math.min(ring.x, launchX);
          const maxLx = Math.max(ring.x, launchX);
          
          const intersectsX = Math.max(plat.minX, minLx) <= Math.min(plat.maxX, maxLx);
          const intersectsZ = Math.max(plat.minZ, minLz) <= Math.min(plat.maxZ, maxLz);
          
          if (intersectsX && intersectsZ && plat.y <= launchY + PLAYER_HEIGHT) {
            const nextKey = stateKey(plat.id, activatedSwitches);
            if (!visitedStates.has(nextKey)) {
              visitedStates.add(nextKey);
              reachablePlatforms.add(plat.id);
              queue.push({ platId: plat.id, activatedSwitches });
            }
          }
        }
      }
    }

    // 5. Jump to other platforms
    for (const nextPlat of level.platforms) {
      if (nextPlat.id === currentPlat.id) continue;
      if (!isPlatformActive(nextPlat)) continue;

      let canJump = false;

      // Regular jump check (accounting for timed elevator step-on heights)
      const distH = getPlatformHorizontalDistance(currentPlat, nextPlat);
      const targetY = nextPlat.minY !== undefined ? nextPlat.minY : nextPlat.y;
      const maxJumpDist = getMaxJumpDistance(currentPlat.y, targetY);
      if (maxJumpDist > 0 && distH <= maxJumpDist) {
        canJump = true;
      }

      // Check Gravity Lifts
      if (!canJump) {
        for (const lift of level.gravityLifts) {
          const distToLiftCurr = Math.sqrt(((currentPlat.minX + currentPlat.maxX)/2 - lift.x)**2 + ((currentPlat.minZ + currentPlat.maxZ)/2 - lift.z)**2);
          if (distToLiftCurr <= lift.radius + 1.0) {
            const liftTopY = lift.height;
            const distHNext = getPlatformHorizontalDistance({ minX: lift.x - lift.radius, maxX: lift.x + lift.radius, minZ: lift.z - lift.radius, maxZ: lift.z + lift.radius, y: liftTopY }, nextPlat);
            const maxJumpFromLift = getMaxJumpDistance(liftTopY, nextPlat.y);
            if (maxJumpFromLift > 0 && distHNext <= maxJumpFromLift) {
              canJump = true;
              break;
            }
          }
        }
      }

      // Check Gravity Fields
      if (!canJump) {
        for (const field of level.gravityFields) {
          const distX = getIntervalDistance(currentPlat.minX, currentPlat.maxX, field.minX, field.maxX);
          const distZ = getIntervalDistance(currentPlat.minZ, currentPlat.maxZ, field.minZ, field.maxZ);
          const distHCurr = Math.sqrt(distX * distX + distZ * distZ);
          
          if (distHCurr <= BASE_JUMP_DIST && currentPlat.y >= field.minY && currentPlat.y <= field.maxY) {
            const distNextX = getIntervalDistance(field.minX, field.maxX, nextPlat.minX, nextPlat.maxX);
            const distNextZ = getIntervalDistance(field.minZ, field.maxZ, nextPlat.minZ, nextPlat.maxZ);
            const distHNext = Math.sqrt(distNextX * distNextX + distNextZ * distNextZ);
            
            const maxJumpFromField = getMaxJumpDistance(field.maxY, nextPlat.y);
            if (distHNext <= (maxJumpFromField > 0 ? maxJumpFromField + 3.0 : 10.0)) {
              canJump = true;
              break;
            }
          }
        }
      }

      if (canJump) {
        const nextKey = stateKey(nextPlat.id, activatedSwitches);
        if (!visitedStates.has(nextKey)) {
          visitedStates.add(nextKey);
          reachablePlatforms.add(nextPlat.id);
          queue.push({ platId: nextPlat.id, activatedSwitches });
        }
      }
    }
  }

  // Verification results
  const unreachableCrystals = level.crystals.filter(c => !reachableCrystals.has(c.id));
  const targetReachable = Array.from(reachablePlatforms).some(platId => {
    const plat = level.platforms.find(p => p.id === platId);
    return isPointOnPlatform(level.target.x, level.target.z, plat);
  });

  console.log(`Platforms reachable: [${Array.from(reachablePlatforms).join(', ')}]`);
  console.log(`Crystals reachable: ${reachableCrystals.size} / ${level.crystals.length}`);
  console.log(`Target platform reachable: ${targetReachable ? 'YES' : 'NO'}`);

  if (unreachableCrystals.length > 0) {
    console.log(`\x1b[31m[FAILED] Unreachable crystals: [${unreachableCrystals.map(c => c.id).join(', ')}]\x1b[0m`);
    unreachableCrystals.forEach(c => {
      console.log(`  - Crystal ${c.id} at (${c.x}, ${c.y}, ${c.z})`);
    });
  }

  if (!targetReachable) {
    console.log(`\x1b[31m[FAILED] Target platform at (${level.target.x}, ${level.target.y}, ${level.target.z}) is unreachable!\x1b[0m`);
  }

  const success = unreachableCrystals.length === 0 && targetReachable;
  if (success) {
    console.log(`\x1b[32m[SUCCESS] Sector ${levelNum} is 100% playable and reachable!\x1b[0m`);
  } else {
    console.log(`\x1b[31m[FAILURE] Sector ${levelNum} has reachability issues!\x1b[0m`);
  }
  
  return success;
}

// Run for all levels or a specific one
const args = process.argv.slice(2);
const specificLevel = args[0] ? parseInt(args[0], 10) : null;

let overallSuccess = true;

if (specificLevel) {
  overallSuccess = runReachabilityCheck(specificLevel);
} else {
  for (let i = 1; i <= 9; i++) {
    const ok = runReachabilityCheck(i);
    if (!ok) overallSuccess = false;
  }
}

console.log(`\n==================================================`);
if (overallSuccess) {
  console.log(`\x1b[32mALL SECTORS VERIFIED AND 100% REACHABLE!\x1b[0m`);
  process.exit(0);
} else {
  console.log(`\x1b[31mREACHABILITY CHECK FAILED IN ONE OR MORE SECTORS!\x1b[0m`);
  process.exit(1);
}
