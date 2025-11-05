import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture, PivotControls } from '@react-three/drei'
import * as THREE from 'three'
import { calculateWallVisibility } from './utils/cameraFacingUtil'
import { initialPlanePositions, wallVertexShader, wallFragmentShader } from './assets/walls'
import { Shape, MAX_SHAPES, DEFAULT_SHAPE_RADIUS, shapeTypeToNumber } from './assets/shapes'

interface SDFRoomTestProps {
  shapes: Shape[]
  selectedShape: string | null
  onShapePositionChange: (id: string, position: THREE.Vector3) => void
  onShapeScaleChange: (id: string, scale: THREE.Vector3) => void
  onShapeRotationChange: (id: string, rotation: THREE.Euler) => void
  onShapeSelect: (id: string | null) => void
  collidersConfirmed?: boolean
}

interface ShapeVisualizationProps {
  shape: Shape
  isSelected: boolean
  onSelect: () => void
  onPositionChange: (position: THREE.Vector3) => void
  onScaleChange: (scale: THREE.Vector3) => void
  onRotationChange: (rotation: THREE.Euler) => void
  collidersConfirmed: boolean
}

function ShapeVisualization({ shape, isSelected, onSelect, onPositionChange, onScaleChange, onRotationChange, collidersConfirmed }: ShapeVisualizationProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  // Get geometry based on shape type
  const getGeometry = () => {
    switch (shape.shapeType) {
      case 'sphere':
        return <sphereGeometry args={[shape.radius, 32, 32]} />
      case 'box':
        return <boxGeometry args={[shape.radius * 2, shape.radius * 2, shape.radius * 2]} />
      case 'torus':
        return <torusGeometry args={[shape.radius, shape.radius * 0.5, 16, 32]} />
      case 'roundCone':
        return <coneGeometry args={[shape.radius, shape.radius * 2, 32]} />
      case 'capsule':
        return <capsuleGeometry args={[shape.radius * 0.5, shape.radius * 2, 16, 32]} />
      case 'cylinder':
        return <cylinderGeometry args={[shape.radius * 0.8, shape.radius * 0.8, shape.radius * 2, 32]} />
      default:
        return <sphereGeometry args={[shape.radius, 32, 32]} />
    }
  }
  
  return (
    <>
      {isSelected && !collidersConfirmed ? (
        <group position={shape.position}>
        <PivotControls
          anchor={[0, 0, 0]}
          depthTest={false}
          scale={1}
          activeAxes={[true, true, true]}
          disableRotations={false}
          onDrag={(l, deltaL, w, deltaW) => {
            const newPos = new THREE.Vector3().setFromMatrixPosition(w)
            const newScale = new THREE.Vector3().setFromMatrixScale(w)
              const newRot = new THREE.Euler().setFromRotationMatrix(w)
            onPositionChange(newPos)
            onScaleChange(newScale)
              onRotationChange(newRot)
          }}
        >
          <mesh 
            ref={meshRef}
            onClick={(e) => {
              e.stopPropagation()
              onSelect()
            }}
            visible={false}
          >
            {getGeometry()}
          </mesh>
        </PivotControls>
        </group>
      ) : (
        <group position={shape.position}>
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
          {getGeometry()}
        </mesh>
        </group>
      )}
    </>
  )
}

export function SDFRoomTest({ 
  shapes, 
  selectedShape,
  onShapePositionChange,
  onShapeScaleChange,
  onShapeRotationChange,
  onShapeSelect,
  collidersConfirmed = false
}: SDFRoomTestProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  // 5개의 평면(바닥 + 4개 벽)의 위치를 관리
  const planePositions = initialPlanePositions
  
  // 텍스쳐 로드 (public/texture/Cement_BaseColor.jpg)
  // GitHub Pages 배포 시 basePath 적용
  const basePath = process.env.NODE_ENV === 'production' ? '/own-room' : ''
  const cementTexture = useTexture(`${basePath}/texture/Cement_BaseColor.jpg`) as THREE.Texture
  cementTexture.wrapS = THREE.RepeatWrapping
  cementTexture.wrapT = THREE.RepeatWrapping
  cementTexture.anisotropy = 16
  cementTexture.repeat.set(12, 12)
  
  const material = useMemo(() => {
    // Initialize shape arrays with default values
    const shapePositions = Array(MAX_SHAPES).fill(null).map(() => new THREE.Vector3(0, 0, 0))
    const shapeRadii = Array(MAX_SHAPES).fill(DEFAULT_SHAPE_RADIUS)
    const shapeScales = Array(MAX_SHAPES).fill(null).map(() => new THREE.Vector3(1, 1, 1))
    const shapeRotations = Array(MAX_SHAPES).fill(null).map(() => new THREE.Vector3(0, 0, 0))
    const shapeOperations = Array(MAX_SHAPES).fill(0.0) // 0.0 = union
    const shapeTypes = Array(MAX_SHAPES).fill(0.0) // 0.0 = sphere
    
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
        // Shape 관련
        uShapeCount: { value: 0 },
        uShapePositions: { value: shapePositions },
        uShapeRadii: { value: shapeRadii },
        uShapeScales: { value: shapeScales },
        uShapeRotations: { value: shapeRotations },
        uShapeOperations: { value: shapeOperations },
        uShapeTypes: { value: shapeTypes },
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
      
      // Shape 데이터를 uniform에 업데이트
      material.uniforms.uShapeCount.value = shapes.length
      shapes.forEach((shape, index) => {
        if (index < MAX_SHAPES) {
          material.uniforms.uShapePositions.value[index].copy(shape.position)
          material.uniforms.uShapeRadii.value[index] = shape.radius
          material.uniforms.uShapeScales.value[index].copy(shape.scale)
          material.uniforms.uShapeRotations.value[index].set(shape.rotation.x, shape.rotation.y, shape.rotation.z)
          material.uniforms.uShapeOperations.value[index] = shape.operation === 'union' ? 0.0 : 1.0
          material.uniforms.uShapeTypes.value[index] = shapeTypeToNumber(shape.shapeType)
        }
      })
    }
  })
  
  return (
    <>
      <mesh ref={meshRef} material={material}>
        <boxGeometry args={[100, 100, 100]} />
      </mesh>
      
      {/* Render visible shapes with PivotControls */}
      {shapes.map((shape) => (
        <ShapeVisualization
          key={shape.id}
          shape={shape}
          isSelected={selectedShape === shape.id}
          onSelect={() => onShapeSelect(shape.id)}
          onPositionChange={(pos) => onShapePositionChange(shape.id, pos)}
          onScaleChange={(scale) => onShapeScaleChange(shape.id, scale)}
          onRotationChange={(rot) => onShapeRotationChange(shape.id, rot)}
          collidersConfirmed={collidersConfirmed}
        />
      ))}
    </>
  )
}

