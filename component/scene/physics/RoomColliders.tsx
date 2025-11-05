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
  // 마운트 시점의 shapes를 ref에 저장
  const initialShapesRef = useRef(shapes)
  
  // 컴포넌트가 마운트될 때 한 번만 계산 (key 변경으로 재마운트됨)
  const boxColliders = useMemo(() => {
    console.log('Voxelizing scene for colliders...')
    return generateVoxelColliders(initialPlanePositions, initialShapesRef.current, 0.12)
  }, []) // 빈 dependency - 마운트 시에만 실행

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
