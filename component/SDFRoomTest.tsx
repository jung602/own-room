import { useRef, useMemo, useEffect, useState } from 'react'
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
  onSphereScaleChange: (id: string, scale: THREE.Vector3) => void
  onSphereSelect: (id: string | null) => void
  onScaleDragChange: (isDragging: boolean) => void
  collidersConfirmed?: boolean
}

interface SphereVisualizationProps {
  sphere: Sphere
  isSelected: boolean
  onSelect: () => void
  onPositionChange: (position: THREE.Vector3) => void
  onScaleChange: (scale: THREE.Vector3) => void
  onScaleDragChange: (isDragging: boolean) => void
  collidersConfirmed: boolean
}

function SphereVisualization({ sphere, isSelected, onSelect, onPositionChange, onScaleChange, onScaleDragChange, collidersConfirmed }: SphereVisualizationProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [isDraggingScale, setIsDraggingScale] = useState(false)
  const dragStartPos = useRef<THREE.Vector3 | null>(null)
  const dragStartScale = useRef<THREE.Vector3 | null>(null)
  const dragAxis = useRef<'x' | 'y' | 'uniform' | null>(null)
  const isTransformDragging = useRef(false)
  
  // Position 동기화: TransformControls가 드래그 중이 아닐 때만 업데이트
  useEffect(() => {
    if (meshRef.current && !isTransformDragging.current) {
      meshRef.current.position.copy(sphere.position)
    }
  }, [sphere.position])
  
  const handleScaleHandlePointerDown = (e: any, axis: 'x' | 'y' | 'uniform') => {
    e.stopPropagation()
    // 즉시 TransformControls 비활성화
    setIsDraggingScale(true)
    dragAxis.current = axis
    dragStartScale.current = sphere.scale.clone()
    onScaleDragChange(true) // OrbitControls 비활성화
    
    // 추가 이벤트 전파 차단
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation()
    }
  }
  
  const handlePointerMove = (e: PointerEvent) => {
    if (!isDraggingScale || !dragStartScale.current || !dragAxis.current) return
    
    // Calculate drag distance based on mouse movement
    const deltaX = e.movementX * 0.01
    const deltaY = -e.movementY * 0.01
    
    let newScale = sphere.scale.clone()
    
    if (dragAxis.current === 'x') {
      newScale.x = Math.max(0.1, newScale.x + deltaX)
    } else if (dragAxis.current === 'y') {
      newScale.y = Math.max(0.1, newScale.y + deltaY)
    } else if (dragAxis.current === 'uniform') {
      const delta = (deltaX + deltaY) * 0.5
      const scaleFactor = 1 + delta
      newScale.multiplyScalar(Math.max(0.1, scaleFactor))
    }
    
    onScaleChange(newScale)
  }
  
  const handlePointerUp = () => {
    if (isDraggingScale) {
      onScaleDragChange(false) // OrbitControls 재활성화
    }
    setIsDraggingScale(false)
    dragStartPos.current = null
    dragStartScale.current = null
    dragAxis.current = null
  }
  
  useEffect(() => {
    if (isSelected && !collidersConfirmed) {
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
      return () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelected, collidersConfirmed, sphere.scale, isDraggingScale])
  
  // Calculate handle positions based on sphere radius and scale
  const handleSize = 0.1
  const handleDistance = sphere.radius * 1.2
  
  return (
    <group>
      {/* 항상 보이지 않는 mesh (TransformControls용) */}
      <mesh 
        ref={meshRef}
        onClick={(e) => {
          if (!collidersConfirmed) {
            e.stopPropagation()
            onSelect()
          }
        }}
        visible={false}
      >
        <sphereGeometry args={[sphere.radius, 32, 32]} />
      </mesh>
      
      {isSelected && meshRef.current && !collidersConfirmed && (
        <>
          <TransformControls
            object={meshRef.current}
            mode="translate"
            enabled={!isDraggingScale}
            onMouseDown={() => {
              isTransformDragging.current = true
            }}
            onMouseUp={() => {
              isTransformDragging.current = false
            }}
            onObjectChange={() => {
              if (meshRef.current && !isDraggingScale) {
                onPositionChange(meshRef.current.position)
              }
            }}
          />
          
          {/* X-axis scale handle (red, right) */}
          <mesh
            position={[
              sphere.position.x + handleDistance * sphere.scale.x,
              sphere.position.y,
              sphere.position.z
            ]}
            onPointerDown={(e) => {
              e.stopPropagation()
              handleScaleHandlePointerDown(e, 'x')
            }}
          >
            <sphereGeometry args={[handleSize, 16, 16]} />
            <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
          </mesh>
          
          {/* Y-axis scale handle (green, top) */}
          <mesh
            position={[
              sphere.position.x,
              sphere.position.y + handleDistance * sphere.scale.y,
              sphere.position.z
            ]}
            onPointerDown={(e) => {
              e.stopPropagation()
              handleScaleHandlePointerDown(e, 'y')
            }}
          >
            <sphereGeometry args={[handleSize, 16, 16]} />
            <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.5} />
          </mesh>
          
          {/* Uniform scale handle (yellow, diagonal) */}
          <mesh
            position={[
              sphere.position.x + handleDistance * sphere.scale.x * 0.707,
              sphere.position.y + handleDistance * sphere.scale.y * 0.707,
              sphere.position.z + handleDistance * sphere.scale.z * 0.707
            ]}
            onPointerDown={(e) => {
              e.stopPropagation()
              handleScaleHandlePointerDown(e, 'uniform')
            }}
          >
            <sphereGeometry args={[handleSize, 16, 16]} />
            <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={0.5} />
          </mesh>
        </>
      )}
    </group>
  )
}

export function SDFRoomTest({ 
  spheres, 
  selectedSphere,
  onSpherePositionChange,
  onSphereScaleChange,
  onSphereSelect,
  onScaleDragChange,
  collidersConfirmed = false
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
    const sphereScales = Array(MAX_SPHERES).fill(null).map(() => new THREE.Vector3(1, 1, 1))
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
        // 카메라 near/far plane
        uCameraNear: { value: 0.1 },
        uCameraFar: { value: 1000.0 },
        // 텍스쳐 관련
        uTexture: { value: cementTexture },
        uTexRepeat: { value: 2.0 },
        // Sphere 관련
        uSphereCount: { value: 0 },
        uSpherePositions: { value: spherePositions },
        uSphereRadii: { value: sphereRadii },
        uSphereScales: { value: sphereScales },
        uSphereOperations: { value: sphereOperations },
      },
      transparent: true,
      vertexShader: wallVertexShader,
      fragmentShader: wallFragmentShader,
      side: THREE.DoubleSide,
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
      
      // Update camera planes
      material.uniforms.uCameraNear.value = state.camera.near
      material.uniforms.uCameraFar.value = state.camera.far
      
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
          material.uniforms.uSphereScales.value[index].copy(sphere.scale)
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
          onScaleChange={(scale) => onSphereScaleChange(sphere.id, scale)}
          onScaleDragChange={onScaleDragChange}
          collidersConfirmed={collidersConfirmed}
        />
      ))}
    </>
  )
}

