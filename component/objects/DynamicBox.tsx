import { useRef, useEffect } from 'react'
import { useBox } from '@react-three/cannon'
import * as THREE from 'three'
import { midiSound } from '../utils/midiSound'

interface DynamicBoxProps {
  id: string
  initialPosition: [number, number, number]
  size?: [number, number, number]
  color?: string
  isDragging: boolean
  dragPosition: THREE.Vector3 | null
  isOutOfBounds?: boolean
  onPointerDown: (id: string, position: THREE.Vector3) => void
}

export function DynamicBox({
  id,
  initialPosition,
  size = [0.5, 0.5, 0.5],
  color = '#4299e1',
  isDragging,
  dragPosition,
  isOutOfBounds = false,
  onPointerDown,
}: DynamicBoxProps) {
  const lastCollisionTimeRef = useRef<number>(0)
  const collisionCountRef = useRef<number>(0)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  
  // 충돌 이벤트 핸들러
  const handleCollision = (event: any) => {
    const now = Date.now()
    const timeSinceLastCollision = now - lastCollisionTimeRef.current
    
    // 충돌 속도 계산
    const impactVelocity = event.contact?.impactVelocity || 0
    const velocity = Math.abs(impactVelocity)
    
    // 최소 속도 임계값 (너무 작은 충돌은 무시)
    if (velocity < 0.5) return
    
    // 짧은 시간 내 연속 충돌이면 카운트 증가
    if (timeSinceLastCollision < 500) {
      collisionCountRef.current = Math.min(collisionCountRef.current + 1, 7)
    } else {
      collisionCountRef.current = 0
    }
    
    lastCollisionTimeRef.current = now
    
    // MIDI 피아노 소리 재생 (충돌 횟수에 따라 음높이 증가)
    const noteIndex = collisionCountRef.current
    const normalizedVelocity = Math.min(velocity / 10, 1) // 속도 정규화
    midiSound.play(noteIndex, normalizedVelocity)
    
    // 0.5초 후 카운트 리셋
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current)
    }
    resetTimerRef.current = setTimeout(() => {
      collisionCountRef.current = 0
    }, 500)
  }
  
  const [ref, api] = useBox(() => ({
    mass: 1,
    position: initialPosition,
    args: size,
    onCollide: handleCollision,
  }))

  const meshRef = useRef<THREE.Mesh>(null)
  const velocityRef = useRef<THREE.Vector3>(new THREE.Vector3())
  const currentPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(...initialPosition))
  const savedInitialPosition = useRef<[number, number, number]>(initialPosition)

  // 현재 위치 추적
  useEffect(() => {
    const unsubscribe = api.position.subscribe((pos) => {
      currentPositionRef.current.set(pos[0], pos[1], pos[2])
    })
    return unsubscribe
  }, [api])

  // 드래그 상태에 따른 물리 및 렌더링 처리
  useEffect(() => {
    if (isDragging && dragPosition) {
      // 드래그 중에는 물리 엔진 비활성화
      api.mass.set(0)
      api.velocity.set(0, 0, 0)
      api.angularVelocity.set(0, 0, 0)
      api.position.set(dragPosition.x, dragPosition.y, dragPosition.z)
      
      // 드래그 중에는 항상 앞에 보이도록 renderOrder 설정
      if (meshRef.current) {
        meshRef.current.renderOrder = 999
      }
    } else if (!isDragging) {
      // 드롭 시
      if (meshRef.current) {
        meshRef.current.renderOrder = 0
      }
      
      // 범위를 벗어났으면 초기 위치로 리셋
      if (isOutOfBounds) {
        api.position.set(...savedInitialPosition.current)
        api.velocity.set(0, 0, 0)
        api.angularVelocity.set(0, 0, 0)
      }
      
      // 물리 엔진 활성화 - 자연스럽게 떨어짐
      api.mass.set(1)
    }
  }, [isDragging, dragPosition, isOutOfBounds, api])

  // Cleanup - 타이머 정리
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  // 범위를 벗어났을 때 색상 변경
  const displayColor = isDragging && isOutOfBounds ? '#ff6b6b' : color

  return (
    <mesh
      ref={(node) => {
        // @ts-ignore - react-three/cannon의 ref 타입 문제
        ref.current = node
        meshRef.current = node
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onPointerDown(id, currentPositionRef.current)
      }}
      castShadow
    >
      <boxGeometry args={size} />
      <meshStandardMaterial 
        color={displayColor}
        transparent={isDragging}
        opacity={isDragging ? 0.8 : 1.0}
      />
    </mesh>
  )
}

