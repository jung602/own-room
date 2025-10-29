import { useRef, useEffect } from 'react'
import { useBox } from '@react-three/cannon'
import * as THREE from 'three'

interface DynamicBoxProps {
  id: string
  initialPosition: [number, number, number]
  size?: [number, number, number]
  color?: string
  isDragging: boolean
  dragPosition: THREE.Vector3 | null
  onPointerDown: (id: string) => void
}

export function DynamicBox({
  id,
  initialPosition,
  size = [0.5, 0.5, 0.5],
  color = '#4299e1',
  isDragging,
  dragPosition,
  onPointerDown,
}: DynamicBoxProps) {
  const [ref, api] = useBox(() => ({
    mass: 1,
    position: initialPosition,
    args: size,
  }))

  const velocityRef = useRef<THREE.Vector3>(new THREE.Vector3())

  useEffect(() => {
    if (isDragging && dragPosition) {
      // Disable physics during drag
      api.mass.set(0)
      api.velocity.set(0, 0, 0)
      api.angularVelocity.set(0, 0, 0)
      api.position.set(dragPosition.x, dragPosition.y, dragPosition.z)
    } else if (!isDragging) {
      // Re-enable physics on drop
      api.mass.set(1)
    }
  }, [isDragging, dragPosition, api])

  return (
    <mesh
      ref={ref as any}
      onPointerDown={(e) => {
        e.stopPropagation()
        onPointerDown(id)
      }}
      castShadow
    >
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

