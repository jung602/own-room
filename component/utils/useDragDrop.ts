import { useState, useCallback, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

interface DragState {
  draggedObjectId: string | null
  dragPosition: THREE.Vector3 | null
}

export function useDragDrop() {
  const [dragState, setDragState] = useState<DragState>({
    draggedObjectId: null,
    dragPosition: null,
  })

  const { camera, size } = useThree()
  const dragPlaneRef = useRef(new THREE.Plane())
  const intersectionPointRef = useRef(new THREE.Vector3())
  const raycasterRef = useRef(new THREE.Raycaster())

  const handlePointerDown = useCallback(
    (id: string) => {
      // Create a plane parallel to the camera for 2D-like dragging
      const cameraDirection = new THREE.Vector3()
      camera.getWorldDirection(cameraDirection)
      
      // Get the object's current position as the plane position
      dragPlaneRef.current.setFromNormalAndCoplanarPoint(
        cameraDirection,
        new THREE.Vector3(0, 0, 0) // Will be updated in pointer move
      )

      setDragState({
        draggedObjectId: id,
        dragPosition: null,
      })
    },
    [camera]
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragState.draggedObjectId) return

      // Calculate normalized device coordinates
      const mouse = new THREE.Vector2()
      mouse.x = (event.clientX / size.width) * 2 - 1
      mouse.y = -(event.clientY / size.height) * 2 + 1

      // Update raycaster
      raycasterRef.current.setFromCamera(mouse, camera)

      // Update drag plane to face the camera
      const cameraDirection = new THREE.Vector3()
      camera.getWorldDirection(cameraDirection)
      dragPlaneRef.current.setFromNormalAndCoplanarPoint(
        cameraDirection,
        dragState.dragPosition || new THREE.Vector3(0, 0, 0)
      )

      // Intersect with the drag plane
      if (
        raycasterRef.current.ray.intersectPlane(
          dragPlaneRef.current,
          intersectionPointRef.current
        )
      ) {
        setDragState((prev) => ({
          ...prev,
          dragPosition: intersectionPointRef.current.clone(),
        }))
      }
    },
    [dragState.draggedObjectId, dragState.dragPosition, camera, size]
  )

  const handlePointerUp = useCallback(() => {
    setDragState({
      draggedObjectId: null,
      dragPosition: null,
    })
  }, [])

  return {
    draggedObjectId: dragState.draggedObjectId,
    dragPosition: dragState.dragPosition,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  }
}

