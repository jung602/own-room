import * as THREE from 'three'
import { Sphere } from '../assets/spheres'
import { ROOM_SIZE, WALL_THICKNESS, BLEND_STRENGTH } from '../assets/walls'

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

function sdSphere(p: THREE.Vector3, r: number): number {
  return p.length() - r
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
  spheres: Sphere[]
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

  // Sphere 추가
  for (const sphere of spheres) {
    const sphereP = pos.clone().sub(sphere.position)
    const sphereDist = sdSphere(sphereP, sphere.radius)

    if (sphere.operation === 'union') {
      d = opSmoothUnion(d, sphereDist, k)
    } else {
      d = opSmoothSubtraction(sphereDist, d, k)
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
  spheres: Sphere[],
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
        
        const sdf = calculateSceneSDF(worldPos, wallPositions, spheres)
        voxels[x][y][z] = sdf < 0 // 내부면 true
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

