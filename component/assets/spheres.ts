import * as THREE from 'three'

// Sphere interface
export interface Sphere {
  id: string
  position: THREE.Vector3
  radius: number
  operation: 'union' | 'subtract'
}

// Sphere 상수들
export const MAX_SPHERES = 10           // 최대 sphere 개수
export const DEFAULT_SPHERE_RADIUS = 0.5 // 기본 sphere 반지름

// SDF function for sphere (GLSL)
export const sphereSDFCode = `
  // SDF for sphere
  float sdSphere(vec3 p, float r) {
    return length(p) - r;
  }
`

// Smooth subtraction operation (GLSL)
export const smoothSubtractionCode = `
  // Smooth Subtraction
  float opSmoothSubtraction(float d1, float d2, float k) {
    float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
    return mix(d2, -d1, h) + k * h * (1.0 - h);
  }
`

// Helper function to create a new sphere
export function createSphere(id: string): Sphere {
  return {
    id,
    position: new THREE.Vector3(0, 0, 0),
    radius: DEFAULT_SPHERE_RADIUS,
    operation: 'union'
  }
}

