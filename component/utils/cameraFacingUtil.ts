import * as THREE from 'three'

/**
 * 평면이 카메라를 향하고 있는지 판단하는 유틸리티
 * 카메라가 평면의 앞쪽(normal 방향)에 있으면 true를 반환
 */
export function isPlaneFacingCamera(
  planePosition: THREE.Vector3,
  planeNormal: THREE.Vector3,
  cameraPosition: THREE.Vector3
): boolean {
  // 평면에서 카메라로 향하는 벡터
  const toCamera = new THREE.Vector3()
    .subVectors(cameraPosition, planePosition)
    .normalize()
  
  // 평면의 normal과 카메라 방향의 내적
  // 내적이 양수면 카메라가 평면의 앞쪽에 있음
  const dot = planeNormal.dot(toCamera)
  
  return dot > 0
}

/**
 * 방의 각 벽이 렌더링되어야 하는지 판단
 * 카메라가 보고 있는 방향의 벽만 렌더링 (카메라 뒤쪽 벽은 숨김)
 * 바닥은 항상 렌더링
 */
export interface WallVisibility {
  floor: boolean
  frontWall: boolean
  backWall: boolean
  leftWall: boolean
  rightWall: boolean
}

export function calculateWallVisibility(
  planePositions: THREE.Vector3[],
  cameraPosition: THREE.Vector3
): WallVisibility {
  // 각 벽의 normal 방향 정의
  const normals = [
    new THREE.Vector3(0, 1, 0),   // 바닥 (위로)
    new THREE.Vector3(0, 0, -1),  // 앞 벽 (뒤로)
    new THREE.Vector3(0, 0, 1),   // 뒤 벽 (앞으로)
    new THREE.Vector3(1, 0, 0),   // 왼쪽 벽 (오른쪽으로)
    new THREE.Vector3(-1, 0, 0),  // 오른쪽 벽 (왼쪽으로)
  ]
  
  // 카메라가 벽의 앞쪽에 있으면 렌더링 (뒤쪽에 있으면 숨김)
  // 바닥은 항상 렌더링
  return {
    floor: true, // 바닥은 항상 보임
    frontWall: isPlaneFacingCamera(planePositions[1], normals[1], cameraPosition),
    backWall: isPlaneFacingCamera(planePositions[2], normals[2], cameraPosition),
    leftWall: isPlaneFacingCamera(planePositions[3], normals[3], cameraPosition),
    rightWall: isPlaneFacingCamera(planePositions[4], normals[4], cameraPosition),
  }
}

