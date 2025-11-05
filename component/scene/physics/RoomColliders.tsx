import { useMemo, useRef } from 'react'
import { useBox } from '@react-three/cannon'
import * as THREE from 'three'
import { Shape } from '../assets/shapes'
import { initialPlanePositions } from '../assets/walls'
import { generateVoxelColliders } from './voxelizeColliders'

interface RoomCollidersProps {
  shapes: Shape[]
}

export function RoomColliders({ shapes }: RoomCollidersProps) {
  // shapes의 모든 속성(position, rotation, scale, operation 등)을 직렬화하여 변경 감지
  const shapesKey = useMemo(() => {
    return shapes.map(s => 
      `${s.id}_${s.operation}_${s.position.toArray()}_${s.rotation.toArray()}_${s.scale.toArray()}`
    ).join('|')
  }, [shapes])
  
  // shapesKey가 변경될 때마다 collider 재계산
  const boxColliders = useMemo(() => {
    console.log('Generating colliders: walls (simple boxes) + shapes (dynamic voxel size)...')
    console.log(`Shapes key: ${shapesKey}`)
    return generateVoxelColliders(initialPlanePositions, shapes)
  }, [shapesKey, shapes]) // shapesKey로 operation 변경 감지

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
