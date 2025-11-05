import * as THREE from 'three'
import { smoothUnionCode, smoothSubtractionCode } from './smooth'

// Shape types
export type ShapeType = 'sphere' | 'box' | 'torus' | 'roundCone' | 'capsule' | 'cylinder'

// Shape interface
export interface Shape {
  id: string
  position: THREE.Vector3
  radius: number
  scale: THREE.Vector3
  operation: 'union' | 'subtract'
  shapeType: ShapeType
}

// Shape 상수들
export const MAX_SHAPES = 10           // 최대 shape 개수
export const DEFAULT_SHAPE_RADIUS = 0.5 // 기본 shape 반지름

// SDF functions for various shapes (GLSL)

// Sphere SDF
export const sphereSDFCode = `
  // SDF for sphere
  float sdSphere(vec3 p, float r, vec3 scale) {
    vec3 scaledP = p / scale;
    return (length(scaledP) - r) * min(min(scale.x, scale.y), scale.z);
  }
`

// Rounded Box SDF
export const boxSDFCode = `
  // SDF for rounded box
  float sdBox(vec3 p, vec3 b, vec3 scale) {
    vec3 scaledP = p / scale;
    vec3 d = abs(scaledP) - b;
    float roundRadius = min(min(b.x, b.y), b.z) * 0.4;
    return (min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0)) - roundRadius) * min(min(scale.x, scale.y), scale.z);
  }
`

// Torus SDF
export const torusSDFCode = `
  // SDF for torus
  float sdTorus(vec3 p, vec2 t, vec3 scale) {
    vec3 scaledP = p / scale;
    vec2 q = vec2(length(scaledP.xz) - t.x, scaledP.y);
    return (length(q) - t.y) * min(min(scale.x, scale.y), scale.z);
  }
`

// Rounded Cone SDF
export const roundConeSDFCode = `
  // SDF for rounded cone
  float sdRoundCone(vec3 p, float r1, float r2, float h, vec3 scale) {
    vec3 scaledP = p / scale;
    vec2 q = vec2(length(scaledP.xz), scaledP.y);
    float b = (r1 - r2) / h;
    float a = sqrt(1.0 - b * b);
    float k = dot(q, vec2(-b, a));
    float roundRadius = min(r1, r2) * 0.1; // 10% of smaller radius
    if(k < 0.0) return length(q) - r1 - roundRadius;
    if(k > a * h) return length(q - vec2(0.0, h)) - r2 - roundRadius;
    return dot(q, vec2(a, b)) - r1 - roundRadius;
  }
`

// Capsule SDF
export const capsuleSDFCode = `
  // SDF for capsule
  float sdCapsule(vec3 p, float h, float r, vec3 scale) {
    vec3 scaledP = p / scale;
    scaledP.y -= clamp(scaledP.y, 0.0, h);
    return (length(scaledP) - r) * min(min(scale.x, scale.y), scale.z);
  }
`

// Rounded Cylinder SDF
export const cylinderSDFCode = `
  // SDF for rounded cylinder
  float sdCylinder(vec3 p, float h, float r, vec3 scale) {
    vec3 scaledP = p / scale;
    vec2 d = abs(vec2(length(scaledP.xz), scaledP.y)) - vec2(r, h);
    float roundRadius = min(r, h) * 0.4;
    return (min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - roundRadius) * min(min(scale.x, scale.y), scale.z);
  }
`

// Export all SDF codes as a single string
export const allShapeSDFCode = `
  ${sphereSDFCode}
  ${boxSDFCode}
  ${torusSDFCode}
  ${roundConeSDFCode}
  ${capsuleSDFCode}
  ${cylinderSDFCode}
`

// Export smooth operations
export { smoothUnionCode, smoothSubtractionCode }

// Helper function to create a new shape
export function createShape(id: string, shapeType: ShapeType = 'sphere'): Shape {
  return {
    id,
    position: new THREE.Vector3(0, 0, 0),
    radius: DEFAULT_SHAPE_RADIUS,
    scale: new THREE.Vector3(1, 1, 1),
    operation: 'union',
    shapeType
  }
}

// Shape type to number mapping for GLSL
export function shapeTypeToNumber(shapeType: ShapeType): number {
  const mapping: Record<ShapeType, number> = {
    sphere: 0,
    box: 1,
    torus: 2,
    roundCone: 3,
    capsule: 4,
    cylinder: 5
  }
  return mapping[shapeType]
}

// Shape display names for UI
export const shapeDisplayNames: Record<ShapeType, string> = {
  sphere: 'Sphere',
  box: 'Rounded Box',
  torus: 'Torus',
  roundCone: 'Rounded Cone',
  capsule: 'Capsule',
  cylinder: 'Rounded Cylinder'
}

