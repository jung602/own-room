import { useMemo } from 'react'
import { useBox } from '@react-three/cannon'
import * as THREE from 'three'
import { Sphere } from '../assets/spheres'
import { initialPlanePositions } from '../assets/walls'
import { generateVoxelColliders } from './voxelizeColliders'

interface RoomCollidersProps {
  spheres: Sphere[]
}

export function RoomColliders({ spheres }: RoomCollidersProps) {
  // Confirm 시점의 씬을 voxelize하여 box collider들 생성
  const boxColliders = useMemo(() => {
    console.log('Voxelizing scene for colliders...')
    return generateVoxelColliders(initialPlanePositions, spheres, 0.3)
  }, [spheres])

  return (
    <>
      {boxColliders.map((collider, index) => (
        <VoxelBoxCollider
          key={index}
          position={collider.position}
          size={collider.size}
        />
      ))}
    </>
  )
}

interface VoxelBoxColliderProps {
  position: THREE.Vector3
  size: THREE.Vector3
}

function VoxelBoxCollider({ position, size }: VoxelBoxColliderProps) {
  useBox(() => ({
    type: 'Static',
    position: position.toArray() as [number, number, number],
    args: size.toArray() as [number, number, number],
  }))

  // Completely invisible - SDF handles depth and shadows
  return null
}
