'use client'

import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { SDFRoomTest } from '../../component/SDFRoomTest'
import { UIControls } from '../../component/utils/UIControls'
import { Sphere, createSphere, MAX_SPHERES } from '../../component/assets/spheres'

export default function App() {
  const [spheres, setSpheres] = useState<Sphere[]>([])
  const [selectedSphere, setSelectedSphere] = useState<string | null>(null)
  
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
  
  return (
    <div className="w-full h-screen relative">
      <Canvas camera={{ position: [0, 300, 600], fov: 1 }}>
        <color attach="background" args={['#000000']} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <SDFRoomTest 
          spheres={spheres}
          selectedSphere={selectedSphere}
          onSpherePositionChange={handleSpherePositionChange}
          onSphereSelect={setSelectedSphere}
        />
        <OrbitControls makeDefault />
      </Canvas>
      
      {/* UI Overlay */}
      <UIControls
        spheres={spheres}
        onAddSphere={handleAddSphere}
        onDeleteSphere={handleDeleteSphere}
        onToggleOperation={handleToggleOperation}
      />
    </div>
  )
}
