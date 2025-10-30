'use client'

import { useState, useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, N8AO, BrightnessContrast, ToneMapping, DotScreen, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import { SDFRoomTest } from '../../component/SDFRoomTest'
import { UIControls } from '../../component/utils/UIControls'
import { Sphere, createSphere, MAX_SPHERES } from '../../component/assets/spheres'
import { PhysicsScene } from '../../component/physics/PhysicsScene' 
import { RoomColliders } from '../../component/physics/RoomColliders'
import { DynamicBox } from '../../component/objects/DynamicBox'
import { useDragDrop } from '../../component/utils/useDragDrop'
import { initialPlanePositions } from '../../component/assets/walls'
import { generateVoxelColliders } from '../../component/physics/voxelizeColliders'
import { BlendFunction } from 'postprocessing'

interface Box {
  id: string
  initialPosition: [number, number, number]
}

interface SceneContentProps {
  spheres: Sphere[]
  selectedSphere: string | null
  onSpherePositionChange: (id: string, position: THREE.Vector3) => void
  onSphereScaleChange: (id: string, scale: THREE.Vector3) => void
  onSphereSelect: (id: string | null) => void
  onScaleDragChange: (isDragging: boolean) => void
  collidersConfirmed: boolean
  boxes: Box[]
  showColliderWireframe: boolean
  isScaleDragging: boolean
}

// Collider wireframe visualization component (Physics 밖에서 렌더링)
function ColliderWireframes({ spheres }: { spheres: Sphere[] }) {
  // Voxel 기반 collider들 생성 (동일한 로직)
  const boxColliders = useMemo(() => {
    return generateVoxelColliders(initialPlanePositions, spheres, 0.3)
  }, [spheres])

  return (
    <group>
      {boxColliders.map((collider, index) => (
        <mesh key={index} position={collider.position.toArray()}>
          <boxGeometry args={collider.size.toArray()} />
          <meshBasicMaterial color="#cccccc" wireframe />
        </mesh>
      ))}
    </group>
  )
}

function SceneContent({
  spheres,
  selectedSphere,
  onSpherePositionChange,
  onSphereScaleChange,
  onSphereSelect,
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
      {collidersConfirmed && showColliderWireframe && <ColliderWireframes spheres={spheres} />}
      
      <PhysicsScene>
        <SDFRoomTest 
          spheres={spheres}
          selectedSphere={selectedSphere}
          onSpherePositionChange={onSpherePositionChange}
          onSphereScaleChange={onSphereScaleChange}
          onSphereSelect={onSphereSelect}
          onScaleDragChange={onScaleDragChange}
          collidersConfirmed={collidersConfirmed}
        />
        
        {collidersConfirmed && <RoomColliders spheres={spheres} />}
        
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
  const [spheres, setSpheres] = useState<Sphere[]>([])
  const [selectedSphere, setSelectedSphere] = useState<string | null>(null)
  const [collidersConfirmed, setCollidersConfirmed] = useState(false)
  const [boxes, setBoxes] = useState<Box[]>([])
  const [showColliderWireframe, setShowColliderWireframe] = useState(true)
  const [isScaleDragging, setIsScaleDragging] = useState(false)
  
  const handleAddSphere = () => {
    if (spheres.length >= MAX_SPHERES) return
    const newSphere = createSphere(`${spheres.length + 1}`)
    setSpheres([...spheres, newSphere])
    setSelectedSphere(newSphere.id)
  }
  
  const handleDeleteSphere = (id: string) => {
    setSpheres(spheres.filter(sphere => sphere.id !== id))
    if (selectedSphere === id) {
      setSelectedSphere(null)
    }
  }
  
  const handleToggleOperation = (id: string) => {
    setSpheres(spheres.map(sphere => 
      sphere.id === id 
        ? { ...sphere, operation: sphere.operation === 'union' ? 'subtract' : 'union' as const }
        : sphere
    ))
  }
  
  const handleSpherePositionChange = (id: string, newPosition: THREE.Vector3) => {
    setSpheres(spheres.map(sphere => 
      sphere.id === id 
        ? { ...sphere, position: newPosition.clone() }
        : sphere
    ))
  }
  
  const handleSphereScaleChange = (id: string, newScale: THREE.Vector3) => {
    setSpheres(spheres.map(sphere => 
      sphere.id === id 
        ? { ...sphere, scale: newScale.clone() }
        : sphere
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
          spheres={spheres}
          selectedSphere={selectedSphere}
          onSpherePositionChange={handleSpherePositionChange}
          onSphereScaleChange={handleSphereScaleChange}
          onSphereSelect={setSelectedSphere}
          onScaleDragChange={setIsScaleDragging}
          collidersConfirmed={collidersConfirmed}
          boxes={boxes}
          showColliderWireframe={showColliderWireframe}
          isScaleDragging={isScaleDragging}
        />
      </Canvas>
      
      {/* UI Overlay */}
      <UIControls
        spheres={spheres}
        onAddSphere={handleAddSphere}
        onDeleteSphere={handleDeleteSphere}
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
