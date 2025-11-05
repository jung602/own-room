import * as THREE from 'three'
import { Shape } from '../assets/shapes'
import { ROOM_SIZE, WALL_THICKNESS, BLEND_STRENGTH } from '../assets/walls'

// Rotation matrix from Euler angles (XYZ order)
// Shader의 rotationMatrix()와 동일한 로직
function createRotationMatrix(euler: THREE.Euler): THREE.Matrix3 {
  const cx = Math.cos(euler.x)
  const sx = Math.sin(euler.x)
  const cy = Math.cos(euler.y)
  const sy = Math.sin(euler.y)
  const cz = Math.cos(euler.z)
  const sz = Math.sin(euler.z)
  
  // XYZ rotation order
  const rotX = new THREE.Matrix3()
  rotX.set(
    1, 0, 0,
    0, cx, -sx,
    0, sx, cx
  )
  
  const rotY = new THREE.Matrix3()
  rotY.set(
    cy, 0, sy,
    0, 1, 0,
    -sy, 0, cy
  )
  
  const rotZ = new THREE.Matrix3()
  rotZ.set(
    cz, -sz, 0,
    sz, cz, 0,
    0, 0, 1
  )
  
  // Return rotZ * rotY * rotX
  return rotZ.multiply(rotY).multiply(rotX)
}

// SDF 함수들 (Shape 전용)
function sdSphere(p: THREE.Vector3, r: number, scale: THREE.Vector3): number {
  const scaledP = new THREE.Vector3(
    p.x / scale.x,
    p.y / scale.y,
    p.z / scale.z
  )
  const minScale = Math.min(scale.x, Math.min(scale.y, scale.z))
  return (scaledP.length() - r) * minScale
}

function sdBox(p: THREE.Vector3, b: THREE.Vector3, scale: THREE.Vector3): number {
  const scaledP = new THREE.Vector3(
    p.x / scale.x,
    p.y / scale.y,
    p.z / scale.z
  )
  const d = new THREE.Vector3(
    Math.abs(scaledP.x) - b.x,
    Math.abs(scaledP.y) - b.y,
    Math.abs(scaledP.z) - b.z
  )
  const maxD = Math.max(d.x, Math.max(d.y, d.z))
  const maxVec = new THREE.Vector3(Math.max(d.x, 0), Math.max(d.y, 0), Math.max(d.z, 0))
  const roundRadius = Math.min(b.x, Math.min(b.y, b.z)) * 0.4 // 10% of smallest dimension
  const minScale = Math.min(scale.x, Math.min(scale.y, scale.z))
  return (Math.min(maxD, 0.0) + maxVec.length() - roundRadius) * minScale
}

function sdTorus(p: THREE.Vector3, t: THREE.Vector2, scale: THREE.Vector3): number {
  const scaledP = new THREE.Vector3(
    p.x / scale.x,
    p.y / scale.y,
    p.z / scale.z
  )
  const q = new THREE.Vector2(
    Math.sqrt(scaledP.x * scaledP.x + scaledP.z * scaledP.z) - t.x,
    scaledP.y
  )
  const minScale = Math.min(scale.x, Math.min(scale.y, scale.z))
  return (q.length() - t.y) * minScale
}

function sdRoundCone(p: THREE.Vector3, r1: number, r2: number, h: number, scale: THREE.Vector3): number {
  const scaledP = new THREE.Vector3(
    p.x / scale.x,
    p.y / scale.y,
    p.z / scale.z
  )
  const q = new THREE.Vector2(
    Math.sqrt(scaledP.x * scaledP.x + scaledP.z * scaledP.z),
    scaledP.y
  )
  const b = (r1 - r2) / h
  const a = Math.sqrt(1.0 - b * b)
  const k = q.dot(new THREE.Vector2(-b, a))
  const roundRadius = Math.min(r1, r2) * 0.1 // 10% of smaller radius
  
  let result: number
  if (k < 0.0) {
    result = q.length() - r1 - roundRadius
  } else if (k > a * h) {
    result = q.distanceTo(new THREE.Vector2(0, h)) - r2 - roundRadius
  } else {
    result = q.dot(new THREE.Vector2(a, b)) - r1 - roundRadius
  }
  const minScale = Math.min(scale.x, Math.min(scale.y, scale.z))
  return result * minScale
}

function sdCapsule(p: THREE.Vector3, h: number, r: number, scale: THREE.Vector3): number {
  const scaledP = new THREE.Vector3(
    p.x / scale.x,
    p.y / scale.y,
    p.z / scale.z
  )
  const clampedY = Math.max(0, Math.min(scaledP.y, h))
  scaledP.y -= clampedY
  const minScale = Math.min(scale.x, Math.min(scale.y, scale.z))
  return (scaledP.length() - r) * minScale
}

function sdCylinder(p: THREE.Vector3, h: number, r: number, scale: THREE.Vector3): number {
  const scaledP = new THREE.Vector3(
    p.x / scale.x,
    p.y / scale.y,
    p.z / scale.z
  )
  const d = new THREE.Vector2(
    Math.abs(Math.sqrt(scaledP.x * scaledP.x + scaledP.z * scaledP.z)) - r,
    Math.abs(scaledP.y) - h
  )
  const maxD = Math.max(d.x, d.y)
  const maxVec = new THREE.Vector2(Math.max(d.x, 0), Math.max(d.y, 0))
  const roundRadius = Math.min(r, h) * 0.4 // 10% of smaller dimension
  const minScale = Math.min(scale.x, Math.min(scale.y, scale.z))
  return (Math.min(maxD, 0.0) + maxVec.length() - roundRadius) * minScale
}

function opSmoothUnion(d1: number, d2: number, k: number): number {
  const h = Math.max(k - Math.abs(d1 - d2), 0.0) / k
  return Math.min(d1, d2) - h * h * k * 0.25
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function opSmoothSubtraction(d1: number, d2: number, k: number): number {
  const h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0)
  return d2 * (1 - h) + (-d1) * h + k * h * (1.0 - h)
}

// Shape의 bounding box 계산
interface BoundingBox {
  min: THREE.Vector3
  max: THREE.Vector3
}

function getShapeBounds(shape: Shape): BoundingBox {
  const maxRadius = shape.radius * Math.max(shape.scale.x, shape.scale.y, shape.scale.z) * 1.5
  return {
    min: shape.position.clone().subScalar(maxRadius),
    max: shape.position.clone().addScalar(maxRadius)
  }
}

// Point가 bounding box 안에 있는지 체크
function isPointInBounds(point: THREE.Vector3, bounds: BoundingBox): boolean {
  return point.x >= bounds.min.x && point.x <= bounds.max.x &&
         point.y >= bounds.min.y && point.y <= bounds.max.y &&
         point.z >= bounds.min.z && point.z <= bounds.max.z
}

interface BoxCollider {
  position: THREE.Vector3
  size: THREE.Vector3
}

// Wall용 단순 box collider 5개 생성 (rounded 값 포함)
function createWallColliders(wallPositions: THREE.Vector3[]): BoxCollider[] {
  const thickness = WALL_THICKNESS
  const roomSize = ROOM_SIZE
  const radius = 0.3 // sdRoundBox의 radius와 동일
  
  return [
    // 바닥 (rounded 값 포함한 실제 크기)
    {
      position: wallPositions[0],
      size: new THREE.Vector3(
        (roomSize + radius) * 2,
        (thickness + radius) * 2,
        (roomSize + radius) * 2
      )
    },
    // 앞 벽
    {
      position: wallPositions[1],
      size: new THREE.Vector3(
        (roomSize + radius) * 2,
        (roomSize + radius) * 2,
        (thickness + radius) * 2
      )
    },
    // 뒤 벽
    {
      position: wallPositions[2],
      size: new THREE.Vector3(
        (roomSize + radius) * 2,
        (roomSize + radius) * 2,
        (thickness + radius) * 2
      )
    },
    // 왼쪽 벽
    {
      position: wallPositions[3],
      size: new THREE.Vector3(
        (thickness + radius) * 2,
        (roomSize + radius) * 2,
        (roomSize + radius) * 2
      )
    },
    // 오른쪽 벽
    {
      position: wallPositions[4],
      size: new THREE.Vector3(
        (thickness + radius) * 2,
        (roomSize + radius) * 2,
        (roomSize + radius) * 2
      )
    }
  ]
}

// Voxel 기반 collider 생성 (Shape 전용, 동적 voxelSize)
export function generateVoxelColliders(
  wallPositions: THREE.Vector3[],
  shapes: Shape[]
): BoxCollider[] {
  // Wall collider 5개 생성 (즉시 반환용)
  const wallColliders = createWallColliders(wallPositions)
  
  // Shape가 없으면 wall만 반환
  if (shapes.length === 0) {
    console.log('Generated 5 wall box colliders (no shapes)')
    return wallColliders
  }
  
  const shapeColliders: BoxCollider[] = []
  
  // 모든 shape의 bounding box를 미리 계산
  const shapeBounds = shapes.map(shape => getShapeBounds(shape))

  // 샘플링 영역: 모든 shape bounds의 union
  let minBound = shapeBounds[0].min.clone()
  let maxBound = shapeBounds[0].max.clone()
  for (const bounds of shapeBounds) {
    minBound.min(bounds.min)
    maxBound.max(bounds.max)
  }
  
  const bounds = {
    min: minBound,
    max: maxBound
  }

  // Shape 영역의 크기 계산
  const boundsSize = new THREE.Vector3(
    bounds.max.x - bounds.min.x,
    bounds.max.y - bounds.min.y,
    bounds.max.z - bounds.min.z
  )
  const averageSize = (boundsSize.x + boundsSize.y + boundsSize.z) / 3

  // 크기에 비례한 동적 voxelSize (작은 shape는 정밀하게, 큰 shape는 크게)
  const dynamicVoxelSize = Math.max(0.15, Math.min(0.2, averageSize / 12))
  
  console.log(`Shape bounds size: ${averageSize.toFixed(2)}, using voxelSize: ${dynamicVoxelSize.toFixed(3)}`)

  // Voxel grid 생성
  const voxels: boolean[][][] = []
  const gridSize = {
    x: Math.ceil(boundsSize.x / dynamicVoxelSize),
    y: Math.ceil(boundsSize.y / dynamicVoxelSize),
    z: Math.ceil(boundsSize.z / dynamicVoxelSize)
  }

  // Shape만 SDF 계산 (wall 제외)
  const sdfThreshold = -dynamicVoxelSize * 0.05
  
  for (let x = 0; x < gridSize.x; x++) {
    voxels[x] = []
    for (let y = 0; y < gridSize.y; y++) {
      voxels[x][y] = []
      for (let z = 0; z < gridSize.z; z++) {
        const worldPos = new THREE.Vector3(
          bounds.min.x + x * dynamicVoxelSize + dynamicVoxelSize * 0.5,
          bounds.min.y + y * dynamicVoxelSize + dynamicVoxelSize * 0.5,
          bounds.min.z + z * dynamicVoxelSize + dynamicVoxelSize * 0.5
        )

        // Shape만 계산 (첫 shape로 초기화)
        let d = Infinity
        for (let i = 0; i < shapes.length; i++) {
          const shape = shapes[i]
          
          // Bounding box 체크로 스킵
          if (!isPointInBounds(worldPos, shapeBounds[i])) {
            continue
          }
          
          const shapeP = worldPos.clone().sub(shape.position)
    const rotMatrix = createRotationMatrix(shape.rotation)
          rotMatrix.transpose()
    shapeP.applyMatrix3(rotMatrix)
    
    let shapeDist: number
    
    switch (shape.shapeType) {
      case 'sphere':
        shapeDist = sdSphere(shapeP, shape.radius, shape.scale)
        break
      case 'box':
        shapeDist = sdBox(shapeP, new THREE.Vector3(shape.radius, shape.radius, shape.radius), shape.scale)
        break
      case 'torus':
        shapeDist = sdTorus(shapeP, new THREE.Vector2(shape.radius, shape.radius * 0.5), shape.scale)
        break
      case 'roundCone':
        shapeDist = sdRoundCone(shapeP, shape.radius, shape.radius * 0.5, shape.radius * 2, shape.scale)
        break
      case 'capsule':
        shapeDist = sdCapsule(shapeP, shape.radius * 2, shape.radius * 0.5, shape.scale)
        break
      case 'cylinder':
        shapeDist = sdCylinder(shapeP, shape.radius, shape.radius * 0.8, shape.scale)
        break
      default:
        shapeDist = sdSphere(shapeP, shape.radius, shape.scale)
    }

          // operation에 따라 처리
          const k = BLEND_STRENGTH
          if (shape.operation === 'union') {
            // union: 첫 번째 또는 기존과 합치기
            if (d === Infinity) {
              d = shapeDist
            } else {
              d = opSmoothUnion(d, shapeDist, k)
            }
          } else {
            // subtract: 기존 geometry가 있을 때만 빼기
            if (d !== Infinity) {
              d = opSmoothSubtraction(shapeDist, d, k)
            }
            // subtract인데 d가 Infinity면 빼는 대상이 없으므로 skip
          }
        }
        
        voxels[x][y][z] = d < sdfThreshold
      }
    }
  }

  // Greedy meshing: 인접한 voxel들을 큰 box로 합치기
  const visited: boolean[][][] = []
  for (let x = 0; x < gridSize.x; x++) {
    visited[x] = []
    for (let y = 0; y < gridSize.y; y++) {
      visited[x][y] = []
      for (let z = 0; z < gridSize.z; z++) {
        visited[x][y][z] = false
      }
    }
  }

  for (let x = 0; x < gridSize.x; x++) {
    for (let y = 0; y < gridSize.y; y++) {
      for (let z = 0; z < gridSize.z; z++) {
        if (!voxels[x][y][z] || visited[x][y][z]) continue

        // X 방향으로 확장
        let xSize = 1
        while (x + xSize < gridSize.x && 
               voxels[x + xSize][y][z] && 
               !visited[x + xSize][y][z]) {
          xSize++
        }

        // Y 방향으로 확장
        let ySize = 1
        let canExpandY = true
        while (y + ySize < gridSize.y && canExpandY) {
          for (let dx = 0; dx < xSize; dx++) {
            if (!voxels[x + dx][y + ySize][z] || visited[x + dx][y + ySize][z]) {
              canExpandY = false
              break
            }
          }
          if (canExpandY) ySize++
        }

        // Z 방향으로 확장
        let zSize = 1
        let canExpandZ = true
        while (z + zSize < gridSize.z && canExpandZ) {
          for (let dx = 0; dx < xSize; dx++) {
            for (let dy = 0; dy < ySize; dy++) {
              if (!voxels[x + dx][y + dy][z + zSize] || visited[x + dx][y + dy][z + zSize]) {
                canExpandZ = false
                break
              }
            }
            if (!canExpandZ) break
          }
          if (canExpandZ) zSize++
        }

        // 방문 표시
        for (let dx = 0; dx < xSize; dx++) {
          for (let dy = 0; dy < ySize; dy++) {
            for (let dz = 0; dz < zSize; dz++) {
              visited[x + dx][y + dy][z + dz] = true
            }
          }
        }

        // Box collider 생성
        const position = new THREE.Vector3(
          bounds.min.x + (x + xSize * 0.5) * dynamicVoxelSize,
          bounds.min.y + (y + ySize * 0.5) * dynamicVoxelSize,
          bounds.min.z + (z + zSize * 0.5) * dynamicVoxelSize
        )
        const size = new THREE.Vector3(
          xSize * dynamicVoxelSize,
          ySize * dynamicVoxelSize,
          zSize * dynamicVoxelSize
        )

        shapeColliders.push({ position, size })
      }
    }
  }

  // Wall과 Shape collider 합치기
  const allColliders = [...wallColliders, ...shapeColliders]
  console.log(`Generated ${wallColliders.length} wall + ${shapeColliders.length} shape = ${allColliders.length} total box colliders`)
  return allColliders
}

