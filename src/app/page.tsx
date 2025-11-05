'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { initialPlanePositions } from '../../component/scene/assets/walls'
import { generateVoxelColliders } from '../../component/scene/physics/voxelizeColliders'


interface Box {
  id: string
  initialPosition: [number, number, number]
}

interface SceneContentProps {
  shapes: Shape[]
  selectedShape: string | null
  onShapePositionChange: (id: string, position: THREE.Vector3) => void
  onShapeScaleChange: (id: string, scale: THREE.Vector3) => void
  onShapeSelect: (id: string | null) => void
  onScaleDragChange: (isDragging: boolean) => void
  collidersConfirmed: boolean
  boxes: Box[]
  showColliderWireframe: boolean
  isScaleDragging: boolean
}



function SceneContent({
  shapes,
  selectedShape,
  onShapePositionChange,
  onShapeScaleChange,
  onShapeSelect,
  onScaleDragChange,
  collidersConfirmed,
  boxes,
  showColliderWireframe,
  isScaleDragging,
}: SceneContentProps) {
  const {
    draggedObjectId,
    dragPosition,
    isOutOfBounds,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useDragDrop()
  
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
      
      {/* Collider wireframes (Physics 밖에서 렌더링) */}
      {collidersConfirmed && showColliderWireframe }
      
      <PhysicsScene>
        <SDFRoomTest 
          shapes={shapes}
          selectedShape={selectedShape}
          onShapePositionChange={onShapePositionChange}
          onShapeScaleChange={onShapeScaleChange}
          onShapeSelect={onShapeSelect}
          onScaleDragChange={onScaleDragChange}
          collidersConfirmed={collidersConfirmed}
        />
        
        {collidersConfirmed && <RoomColliders spheres={shapes} />}
        
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
      
      <OrbitControls makeDefault enabled={!draggedObjectId && !isScaleDragging} />
      
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
  const [collidersConfirmed, setCollidersConfirmed] = useState(false)
  const [boxes, setBoxes] = useState<Box[]>([])
  const [showColliderWireframe, setShowColliderWireframe] = useState(true)
  const [isScaleDragging, setIsScaleDragging] = useState(false)
  
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
    setShapes(shapes.map(shape => 
      shape.id === id 
        ? { ...shape, position: newPosition.clone() }
        : shape
    ))
  }
  
  const handleShapeScaleChange = (id: string, newScale: THREE.Vector3) => {
    setShapes(shapes.map(shape => 
      shape.id === id 
        ? { ...shape, scale: newScale.clone() }
        : shape
    ))
  }
  
  const handleConfirmColliders = () => {
    setCollidersConfirmed(true)
  }
  
  const handleAddBox = () => {
    if (!collidersConfirmed) return
    const newBox: Box = {
      id: `box-${boxes.length + 1}`,
      initialPosition: [0, 3, 0],
    }
    setBoxes([...boxes, newBox])
  }
  
  const handleToggleColliderWireframe = () => {
    setShowColliderWireframe(!showColliderWireframe)
  }
  
  return (
    <div className="w-full h-screen relative">
      <Canvas camera={{ position: [0, 50, 100], fov: 5 }} shadows>
        <SceneContent
          shapes={shapes}
          selectedShape={selectedShape}
          onShapePositionChange={handleShapePositionChange}
          onShapeScaleChange={handleShapeScaleChange}
          onShapeSelect={setSelectedShape}
          onScaleDragChange={setIsScaleDragging}
          collidersConfirmed={collidersConfirmed}
          boxes={boxes}
          showColliderWireframe={showColliderWireframe}
          isScaleDragging={isScaleDragging}
        />
      </Canvas>
      
      {/* UI Overlay */}
      <UIControls
        shapes={shapes}
        onAddShape={handleAddShape}
        onDeleteShape={handleDeleteShape}
        onToggleOperation={handleToggleOperation}
        onConfirmColliders={handleConfirmColliders}
        onAddBox={handleAddBox}
        collidersConfirmed={collidersConfirmed}
        showColliderWireframe={showColliderWireframe}
        onToggleColliderWireframe={handleToggleColliderWireframe}
      />
    </div>
  )
}
