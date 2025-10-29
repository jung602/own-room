import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { calculateWallVisibility } from './utils/cameraFacingUtil'
import { initialPlanePositions, wallVertexShader, wallFragmentShader } from './assets/walls'
import { Sphere, MAX_SPHERES, DEFAULT_SPHERE_RADIUS } from './assets/spheres'

interface SDFRoomTestProps {
  spheres: Sphere[]
  selectedSphere: string | null
  onSpherePositionChange: (id: string, position: THREE.Vector3) => void
  onSphereSelect: (id: string | null) => void
}

interface SphereVisualizationProps {
  sphere: Sphere
  isSelected: boolean
  onSelect: () => void
  onPositionChange: (position: THREE.Vector3) => void
}

function SphereVisualization({ sphere, isSelected, onSelect, onPositionChange }: SphereVisualizationProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(sphere.position)
    }
  }, [sphere.position])
  
  return (
    <group>
      <mesh 
        ref={meshRef}
        position={sphere.position}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        <sphereGeometry args={[sphere.radius, 32, 32]} />
        <meshStandardMaterial 
          color={sphere.operation === 'union' ? '#00ff00' : '#ff0000'}
          transparent
          opacity={0.3}
          wireframe
        />
      </mesh>
      {isSelected && meshRef.current && (
        <TransformControls
          object={meshRef.current}
          mode="translate"
          onObjectChange={() => {
            if (meshRef.current) {
              onPositionChange(meshRef.current.position)
            }
          }}
        />
      )}
    </group>
  )
}

export function SDFRoomTest({ 
  spheres, 
  selectedSphere,
  onSpherePositionChange,
  onSphereSelect
}: SDFRoomTestProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  // 5개의 평면(바닥 + 4개 벽)의 위치를 관리
  const planePositions = initialPlanePositions
  
  // 텍스쳐 로드 (public/texture/Cement_BaseColor.jpg)
  const cementTexture = useTexture('/texture/Cement_BaseColor.jpg') as THREE.Texture
  cementTexture.wrapS = THREE.RepeatWrapping
  cementTexture.wrapT = THREE.RepeatWrapping
  cementTexture.anisotropy = 16
  cementTexture.repeat.set(12, 12)
  
  const material = useMemo(() => {
    // Initialize sphere arrays with default values
    const spherePositions = Array(MAX_SPHERES).fill(null).map(() => new THREE.Vector3(0, 0, 0))
    const sphereRadii = Array(MAX_SPHERES).fill(DEFAULT_SPHERE_RADIUS)
    const sphereOperations = Array(MAX_SPHERES).fill(0.0) // 0.0 = union
    
    return new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        // 각 평면의 위치를 uniform으로 전달 (initialPlanePositions에서 가져옴)
        uFloorPos: { value: planePositions[0].clone() },
        uFrontWallPos: { value: planePositions[1].clone() },
        uBackWallPos: { value: planePositions[2].clone() },
        uLeftWallPos: { value: planePositions[3].clone() },
        uRightWallPos: { value: planePositions[4].clone() },
        // 각 벽의 가시성
        uFloorVisible: { value: 1.0 },
        uFrontWallVisible: { value: 1.0 },
        uBackWallVisible: { value: 1.0 },
        uLeftWallVisible: { value: 1.0 },
        uRightWallVisible: { value: 1.0 },
        // 카메라 위치를 uniform으로 전달 (동적 볼륨 크기 계산용)
        uCameraPos: { value: new THREE.Vector3(0, 0, 0) },
        // 텍스쳐 관련
        uTexture: { value: cementTexture },
        uTexRepeat: { value: 2.0 },
        // Sphere 관련
        uSphereCount: { value: 0 },
        uSpherePositions: { value: spherePositions },
        uSphereRadii: { value: sphereRadii },
        uSphereOperations: { value: sphereOperations },
      },
      transparent: true,
      vertexShader: wallVertexShader,
      fragmentShader: wallFragmentShader,
      side: THREE.DoubleSide
    })
  }, [cementTexture, planePositions])
  
  useFrame((state) => {
    if (meshRef.current && material.uniforms) {
      material.uniforms.iTime.value = state.clock.elapsedTime
      
      // 각 평면 위치를 uniform에 업데이트
      material.uniforms.uFloorPos.value.copy(planePositions[0])
      material.uniforms.uFrontWallPos.value.copy(planePositions[1])
      material.uniforms.uBackWallPos.value.copy(planePositions[2])
      material.uniforms.uLeftWallPos.value.copy(planePositions[3])
      material.uniforms.uRightWallPos.value.copy(planePositions[4])
      
      // 카메라 위치를 uniform에 업데이트 (동적 볼륨 크기 계산용)
      material.uniforms.uCameraPos.value.copy(state.camera.position)
      
      // 카메라 위치 기반으로 벽의 가시성 계산
      const cameraPos = state.camera.position
      const visibility = calculateWallVisibility(planePositions, cameraPos)
      
      // 가시성을 uniform에 업데이트
      material.uniforms.uFloorVisible.value = visibility.floor ? 1.0 : 0.0
      material.uniforms.uFrontWallVisible.value = visibility.frontWall ? 1.0 : 0.0
      material.uniforms.uBackWallVisible.value = visibility.backWall ? 1.0 : 0.0
      material.uniforms.uLeftWallVisible.value = visibility.leftWall ? 1.0 : 0.0
      material.uniforms.uRightWallVisible.value = visibility.rightWall ? 1.0 : 0.0
      
      // Sphere 데이터를 uniform에 업데이트
      material.uniforms.uSphereCount.value = spheres.length
      spheres.forEach((sphere, index) => {
        if (index < MAX_SPHERES) {
          material.uniforms.uSpherePositions.value[index].copy(sphere.position)
          material.uniforms.uSphereRadii.value[index] = sphere.radius
          material.uniforms.uSphereOperations.value[index] = sphere.operation === 'union' ? 0.0 : 1.0
        }
      })
    }
  })
  
  return (
    <>
      <mesh ref={meshRef} material={material}>
        <boxGeometry args={[100, 100, 100]} />
      </mesh>
      
      {/* Render visible spheres with TransformControls */}
      {spheres.map((sphere) => (
        <SphereVisualization
          key={sphere.id}
          sphere={sphere}
          isSelected={selectedSphere === sphere.id}
          onSelect={() => onSphereSelect(sphere.id)}
          onPositionChange={(pos) => onSpherePositionChange(sphere.id, pos)}
        />
      ))}
    </>
  )
}

