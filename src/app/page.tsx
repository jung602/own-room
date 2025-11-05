'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, N8AO, BrightnessContrast, ToneMapping, DotScreen, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import { SDFRoomTest } from '../../component/scene/SDFRoomTest'
import { UIControls } from '../../component/ui/UIControls'
import { Shape, createShape, MAX_SHAPES, ShapeType } from '../../component/scene/assets/shapes'
import { PhysicsScene } from '../../component/scene/physics/PhysicsScene' 
import { RoomColliders } from '../../component/scene/physics/RoomColliders'
import { DynamicBox } from '../../component/scene/objects/DynamicBox'
import { useDragDrop } from '../../component/scene/utils/useDragDrop'

interface Box {
  id: string
  initialPosition: [number, number, number]
}

interface SceneContentProps {
  shapes: Shape[]
  selectedShape: string | null
  onShapePositionChange: (id: string, position: THREE.Vector3) => void
  onShapeScaleChange: (id: string, scale: THREE.Vector3) => void
  onShapeRotationChange: (id: string, rotation: THREE.Euler) => void
  onShapeSelect: (id: string | null) => void
  boxes: Box[]
}



function SceneContent({
  shapes,
  selectedShape,
  onShapePositionChange,
  onShapeScaleChange,
  onShapeRotationChange,
  onShapeSelect,
  boxes,
}: SceneContentProps) {
  const {
    draggedObjectId,
    dragPosition,
    isOutOfBounds,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useDragDrop()
  
  // 기즈모 드래그 상태 추적
  const [isGizmoDragging, setIsGizmoDragging] = useState(false)
  const [shapesKey, setShapesKey] = useState(() => {
    // 초기 key 생성
    return shapes.map(s => 
      `${s.id}-${s.position.toArray().join(',')}-${s.scale.toArray().join(',')}-${s.rotation.toArray().join(',')}-${s.operation}`
    ).join('|')
  })
  
  // shapes가 변경되면 key 업데이트 (단, 드래그 중이 아닐 때만)
  useEffect(() => {
    if (!isGizmoDragging) {
      const newKey = shapes.map(s => 
        `${s.id}-${s.position.toArray().join(',')}-${s.scale.toArray().join(',')}-${s.rotation.toArray().join(',')}-${s.operation}`
      ).join('|')
      setShapesKey(newKey)
    }
  }, [shapes, isGizmoDragging])
  
  // 드래그 핸들러
  const handleGizmoDragStart = () => {
    setIsGizmoDragging(true)
  }
  
  const handleGizmoDragEnd = () => {
    setIsGizmoDragging(false)
    // 드래그 종료 시 즉시 collider 업데이트
    const newKey = shapes.map(s => 
      `${s.id}-${s.position.toArray().join(',')}-${s.scale.toArray().join(',')}-${s.rotation.toArray().join(',')}-${s.operation}`
    ).join('|')
    setShapesKey(newKey)
  }
  
  // Add event listeners for drag
  useEffect(() => {
    const handleMove = (e: PointerEvent) => handlePointerMove(e)
    const handleUp = () => {
      handlePointerUp()
    }
    
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [handlePointerMove, handlePointerUp])
  
  return (
    <>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={1} />
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      
      <PhysicsScene>
        <SDFRoomTest 
          shapes={shapes}
          selectedShape={selectedShape}
          onShapePositionChange={onShapePositionChange}
          onShapeScaleChange={onShapeScaleChange}
          onShapeRotationChange={onShapeRotationChange}
          onShapeSelect={onShapeSelect}
          onDragStart={handleGizmoDragStart}
          onDragEnd={handleGizmoDragEnd}
        />
        
        <RoomColliders key={shapesKey} shapes={shapes} />
        
        {boxes.map((box) => (
          <DynamicBox
            key={box.id}
            id={box.id}
            initialPosition={box.initialPosition}
            isDragging={draggedObjectId === box.id}
            dragPosition={dragPosition}
            isOutOfBounds={draggedObjectId === box.id ? isOutOfBounds : false}
            onPointerDown={handlePointerDown}
          />
        ))}
      </PhysicsScene>
      
      <OrbitControls makeDefault enabled={!draggedObjectId} />
      
      {/* 스크린프린트 스타일 포스트프로세싱 효과 
      <EffectComposer>
      <N8AO
          aoRadius={10}
          intensity={5}
          distanceFalloff={1}
          halfRes={true}
          quality="performance"
        />
        <Noise
          blendFunction={BlendFunction.OVERLAY}
          premultiply={true}
          opacity={0.1}
          factor={0.5}
        />
      </EffectComposer>*/}
    </>
  )
}

export default function App() {
  const [shapes, setShapes] = useState<Shape[]>([])
  const [selectedShape, setSelectedShape] = useState<string | null>(null)
  const [boxes, setBoxes] = useState<Box[]>([])
  
  const handleAddShape = (shapeType: ShapeType) => {
    if (shapes.length >= MAX_SHAPES) return
    const newShape = createShape(`${shapes.length + 1}`, shapeType)
    setShapes([...shapes, newShape])
    setSelectedShape(newShape.id)
  }
  
  const handleDeleteShape = (id: string) => {
    setShapes(shapes.filter(shape => shape.id !== id))
    if (selectedShape === id) {
      setSelectedShape(null)
    }
  }
  
  const handleToggleOperation = (id: string) => {
    setShapes(shapes.map(shape => 
      shape.id === id 
        ? { ...shape, operation: shape.operation === 'union' ? 'subtract' : 'union' as const }
        : shape
    ))
  }
  
  const handleShapePositionChange = (id: string, newPosition: THREE.Vector3) => {
    setShapes(prevShapes => prevShapes.map(shape => 
      shape.id === id 
        ? { ...shape, position: newPosition.clone() }
        : shape
    ))
  }
  
  const handleShapeScaleChange = (id: string, newScale: THREE.Vector3) => {
    setShapes(prevShapes => prevShapes.map(shape => 
      shape.id === id 
        ? { ...shape, scale: newScale.clone() }
        : shape
    ))
  }
  
  const handleShapeRotationChange = (id: string, newRotation: THREE.Euler) => {
    setShapes(prevShapes => prevShapes.map(shape => 
      shape.id === id 
        ? { ...shape, rotation: newRotation.clone() }
        : shape
    ))
  }
  
  const handleAddBox = () => {
    const newBox: Box = {
      id: `box-${boxes.length + 1}`,
      initialPosition: [0, 3, 0],
    }
    setBoxes([...boxes, newBox])
  }
  
  return (
    <div className="w-full h-screen relative">
      <Canvas camera={{ position: [0, 50, 100], fov: 5 }} shadows>
        <SceneContent
          shapes={shapes}
          selectedShape={selectedShape}
          onShapePositionChange={handleShapePositionChange}
          onShapeScaleChange={handleShapeScaleChange}
          onShapeRotationChange={handleShapeRotationChange}
          onShapeSelect={setSelectedShape}
          boxes={boxes}
        />
      </Canvas>
      
      {/* UI Overlay */}
      <UIControls
        shapes={shapes}
        onAddShape={handleAddShape}
        onDeleteShape={handleDeleteShape}
        onToggleOperation={handleToggleOperation}
        onAddBox={handleAddBox}
      />
    </div>
  )
}
