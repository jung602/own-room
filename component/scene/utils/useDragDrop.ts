import { useState, useCallback, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Room 범위 상수 (walls.ts의 ROOM_SIZE와 initialPlanePositions 기반)
const ROOM_BOUNDS = {
  minX: -2.15,
  maxX: 2.15,
  minY: -2.0,
  maxY: 2.0,
  minZ: -2.15,
  maxZ: 2.15,
}

interface DragState {
  draggedObjectId: string | null
  dragPosition: THREE.Vector3 | null
  initialPosition: THREE.Vector3 | null
  dragOffset: THREE.Vector3 | null
  isOutOfBounds: boolean
}

// 위치가 room 범위 내에 있는지 확인
function isPositionInBounds(position: THREE.Vector3): boolean {
  return (
    position.x >= ROOM_BOUNDS.minX &&
    position.x <= ROOM_BOUNDS.maxX &&
    position.y >= ROOM_BOUNDS.minY &&
    position.y <= ROOM_BOUNDS.maxY &&
    position.z >= ROOM_BOUNDS.minZ &&
    position.z <= ROOM_BOUNDS.maxZ
  )
}

export function useDragDrop() {
  const [dragState, setDragState] = useState<DragState>({
    draggedObjectId: null,
    dragPosition: null,
    initialPosition: null,
    dragOffset: null,
    isOutOfBounds: false,
  })

  const { camera, size } = useThree()
  const dragPlaneRef = useRef(new THREE.Plane())
  const intersectionPointRef = useRef(new THREE.Vector3())
  const raycasterRef = useRef(new THREE.Raycaster())

  const handlePointerDown = useCallback(
    (id: string, objectPosition: THREE.Vector3) => {
      // 카메라를 향하는 평면을 객체의 현재 위치에 생성
      const cameraDirection = new THREE.Vector3()
      camera.getWorldDirection(cameraDirection)
      
      // 드래그 평면을 객체 위치에 고정
      dragPlaneRef.current.setFromNormalAndCoplanarPoint(
        cameraDirection,
        objectPosition
      )

      // 현재 마우스 위치와 객체 위치의 오프셋 계산
      const mouse = new THREE.Vector2()
      const event = window.event as MouseEvent
      mouse.x = (event.clientX / size.width) * 2 - 1
      mouse.y = -(event.clientY / size.height) * 2 + 1
      
      raycasterRef.current.setFromCamera(mouse, camera)
      
      const intersection = new THREE.Vector3()
      if (raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersection)) {
        const offset = new THREE.Vector3().subVectors(objectPosition, intersection)
        
        setDragState({
          draggedObjectId: id,
          dragPosition: objectPosition.clone(),
          initialPosition: objectPosition.clone(),
          dragOffset: offset,
          isOutOfBounds: false,
        })
      }
    },
    [camera, size]
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragState.draggedObjectId || !dragState.initialPosition) return

      // 정규화된 마우스 좌표 계산
      const mouse = new THREE.Vector2()
      mouse.x = (event.clientX / size.width) * 2 - 1
      mouse.y = -(event.clientY / size.height) * 2 + 1

      // 레이캐스터 업데이트
      raycasterRef.current.setFromCamera(mouse, camera)

      // 드래그 시작 시점의 평면과 교차점 계산 (평면은 고정)
      const cameraDirection = new THREE.Vector3()
      camera.getWorldDirection(cameraDirection)
      dragPlaneRef.current.setFromNormalAndCoplanarPoint(
        cameraDirection,
        dragState.initialPosition
      )

      // 평면과의 교차점 계산
      if (
        raycasterRef.current.ray.intersectPlane(
          dragPlaneRef.current,
          intersectionPointRef.current
        )
      ) {
        // 오프셋을 적용하여 부드러운 드래그 구현
        const newPosition = intersectionPointRef.current.clone()
        if (dragState.dragOffset) {
          newPosition.add(dragState.dragOffset)
        }

        // room 범위 내에 있는지 확인
        const inBounds = isPositionInBounds(newPosition)

        setDragState((prev) => ({
          ...prev,
          dragPosition: newPosition,
          isOutOfBounds: !inBounds,
        }))
      }
    },
    [dragState.draggedObjectId, dragState.initialPosition, dragState.dragOffset, camera, size]
  )

  const handlePointerUp = useCallback(() => {
    const wasOutOfBounds = dragState.isOutOfBounds
    const initialPos = dragState.initialPosition
    
    setDragState({
      draggedObjectId: null,
      dragPosition: null,
      initialPosition: null,
      dragOffset: null,
      isOutOfBounds: false,
    })
    
    // 범위를 벗어났으면 초기 위치로 리셋해야 함을 알림
    return { shouldReset: wasOutOfBounds, resetPosition: initialPos }
  }, [dragState.isOutOfBounds, dragState.initialPosition])

  return {
    draggedObjectId: dragState.draggedObjectId,
    dragPosition: dragState.dragPosition,
    isOutOfBounds: dragState.isOutOfBounds,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  }
}

