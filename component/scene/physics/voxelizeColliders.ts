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

// SDF 함수들 (셰이더와 동일)
function sdRoundBox(p: THREE.Vector3, b: THREE.Vector3, r: number): number {
  const d = new THREE.Vector3(
    Math.abs(p.x) - b.x,
    Math.abs(p.y) - b.y,
    Math.abs(p.z) - b.z
  )
  const maxD = Math.max(d.x, Math.max(d.y, d.z))
  const maxVec = new THREE.Vector3(Math.max(d.x, 0), Math.max(d.y, 0), Math.max(d.z, 0))
  return Math.min(maxD, 0.0) + maxVec.length() - r
}

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

// 전체 씬의 SDF 계산
export function calculateSceneSDF(
  pos: THREE.Vector3,
  wallPositions: THREE.Vector3[],
  shapes: Shape[]
): number {
  const k = BLEND_STRENGTH
  const thickness = WALL_THICKNESS
  const roomSize = ROOM_SIZE
  const radius = 0.3

  // 바닥
  let floorP = pos.clone().sub(wallPositions[0])
  let floor = sdRoundBox(floorP, new THREE.Vector3(roomSize, thickness, roomSize), radius)

  // 앞 벽
  let frontP = pos.clone().sub(wallPositions[1])
  let frontWall = sdRoundBox(frontP, new THREE.Vector3(roomSize, roomSize, thickness), radius)

  // 뒤 벽
  let backP = pos.clone().sub(wallPositions[2])
  let backWall = sdRoundBox(backP, new THREE.Vector3(roomSize, roomSize, thickness), radius)

  // 왼쪽 벽
  let leftP = pos.clone().sub(wallPositions[3])
  let leftWall = sdRoundBox(leftP, new THREE.Vector3(thickness, roomSize, roomSize), radius)

  // 오른쪽 벽
  let rightP = pos.clone().sub(wallPositions[4])
  let rightWall = sdRoundBox(rightP, new THREE.Vector3(thickness, roomSize, roomSize), radius)

  // 모든 벽 합치기
  let d = floor
  d = opSmoothUnion(d, frontWall, k)
  d = opSmoothUnion(d, backWall, k)
  d = opSmoothUnion(d, leftWall, k)
  d = opSmoothUnion(d, rightWall, k)

  // Shape 추가 (scale, rotation 적용)
  for (const shape of shapes) {
    const shapeP = pos.clone().sub(shape.position)
    
    // Apply rotation (transpose for inverse transform)
    const rotMatrix = createRotationMatrix(shape.rotation)
    rotMatrix.transpose() // Inverse rotation for coordinate transformation
    shapeP.applyMatrix3(rotMatrix)
    
    let shapeDist: number
    
    // Select SDF based on shape type
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

    if (shape.operation === 'union') {
      d = opSmoothUnion(d, shapeDist, k)
    } else {
      d = opSmoothSubtraction(shapeDist, d, k)
    }
  }

  return d
}

interface BoxCollider {
  position: THREE.Vector3
  size: THREE.Vector3
}

// Voxel 기반 collider 생성
export function generateVoxelColliders(
  wallPositions: THREE.Vector3[],
  shapes: Shape[],
  voxelSize: number = 0.2
): BoxCollider[] {
  const colliders: BoxCollider[] = []
  
  // 샘플링 영역 정의 (방 주변)
  const bounds = {
    min: new THREE.Vector3(-3, -3, -3),
    max: new THREE.Vector3(3, 3, 3)
  }

  // Voxel grid 생성
  const voxels: boolean[][][] = []
  const gridSize = {
    x: Math.ceil((bounds.max.x - bounds.min.x) / voxelSize),
    y: Math.ceil((bounds.max.y - bounds.min.y) / voxelSize),
    z: Math.ceil((bounds.max.z - bounds.min.z) / voxelSize)
  }

  // SDF 샘플링하여 내부 voxel 찾기
  // 표면을 더 정확하게 캡처하기 위해 약간의 오프셋 적용
  const sdfThreshold = -voxelSize * 0.05 // 표면에 더 가까운 voxel만 포함
  
  for (let x = 0; x < gridSize.x; x++) {
    voxels[x] = []
    for (let y = 0; y < gridSize.y; y++) {
      voxels[x][y] = []
      for (let z = 0; z < gridSize.z; z++) {
        const worldPos = new THREE.Vector3(
          bounds.min.x + x * voxelSize + voxelSize * 0.5,
          bounds.min.y + y * voxelSize + voxelSize * 0.5,
          bounds.min.z + z * voxelSize + voxelSize * 0.5
        )
        
        const sdf = calculateSceneSDF(worldPos, wallPositions, shapes)
        voxels[x][y][z] = sdf < sdfThreshold // 표면 근처의 내부만 true
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
          bounds.min.x + (x + xSize * 0.5) * voxelSize,
          bounds.min.y + (y + ySize * 0.5) * voxelSize,
          bounds.min.z + (z + zSize * 0.5) * voxelSize
        )
        const size = new THREE.Vector3(
          xSize * voxelSize,
          ySize * voxelSize,
          zSize * voxelSize
        )

        colliders.push({ position, size })
      }
    }
  }

  console.log(`Generated ${colliders.length} box colliders from voxelization`)
  return colliders
}

